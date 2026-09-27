// 雪の村ユール（yule）と、籠城の夜のユール（yule_night）。WORLD_REDESIGN §5.6・§4.3、STORY_BIBLE §7.3・§8.4、V2_PLAN §2.6.1
//   町 56×50。雪に埋もれた家々を、踏み固めた雪の通り（雪の土手に挟まれた「トンネル」）がつなぐ。外は深い雪の土手（歩けない）。
//   北: 凍った池と釣り小屋（氷上の釣り・氷の灯籠の氷）、見張り台（ハルド）、北の門（→ 白竜の峰へ続く北の道）
//   中: 大かまどの集会所（祭の広間・夜数えの板）と広場の大かまど（冬至の火）
//   西の門（→ 凍った湖）・東の門（→ 南の峠・雪の林）、南西: 道具屋・マルガの家・そり犬の小屋、南東: 狩人オラフの家・子どもの秘密基地・ノルデン分室の空き家（村はずれ）
//   南: 雪像の庭（依頼 雪像づくり）
//   灯りの形は「氷の灯籠」（WORLD §5.1）。祭の後（解決）は広場に冬至の火が大灯火として燃える（beacon）。
//   yule_night は同じ形の消灯の刻の版（籠城。門の前にバリケード、NPC は守り手だけ、吹雪）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, S = R.Snow.kit, L = K.L;
    const W = 56, H = 50;

    function build(night) {
      const g = K.grid(W, H, '#');
      K.border(g, 'H', 2);
      // ---------------------------------------------------------------- 開けた所（雪）と通り
      K.blob(g, 13, 8, 11, 6, '.', 'ypond0');          // 凍った池のまわり
      K.blob(g, 12, 8, 8, 4, 'i', 'ypond1', '.');      // 凍った池（氷の上は歩ける）
      K.rect(g, 21, 13, 16, 9, '.');                   // 集会所の前庭
      K.rect(g, 19, 21, 18, 13, 'c');                   // 広場（石畳）
      K.blob(g, 27, 27, 7, 5, 'c', 'yplaza', '#.');
      K.rect(g, 21, 35, 14, 11, '.');                   // 雪像の庭
      K.rect(g, 3, 38, 12, 9, '.');                     // そり犬の小屋
      K.rect(g, 35, 41, 9, 5, '.');                     // 秘密基地の前
      // 家の敷地（家の大きさ＋まわり 1 マス）
      const LOTS = [[36, 4, 7, 6], [44, 4, 7, 6], [36, 12, 7, 6], [44, 11, 8, 7], [3, 16, 8, 7], [11, 17, 7, 6], [4, 30, 8, 7], [12, 30, 7, 6],
        [36, 30, 7, 6], [45, 38, 7, 6], [14, 11, 7, 6]];
      for (const [x, y, w, h] of LOTS) K.rect(g, x, y, w, h, '.');
      // 通り（踏み固めた雪）
      K.path(g, [[26, 0], [26, 13]], ',', 4);                     // 北の門 → 集会所
      K.path(g, [[0, 26], [55, 26]], ',', 3);                     // 西の門 ⇔ 東の門
      K.path(g, [[27, 33], [27, 36]], ',', 2);                    // 広場 → 雪像の庭
      K.path(g, [[39, 9], [39, 12]], ',', 2);                     // ヨルン → 年寄りの家
      K.path(g, [[41, 18], [41, 26]], ',', 2);                    // 北東 → 通り
      K.path(g, [[43, 7], [43, 18]], ',', 2);                     // ソーニャ・武具屋のあいだ
      K.path(g, [[36, 16], [36, 21]], ',', 2);
      K.path(g, [[17, 15], [17, 16], [26, 16]], ',', 2);          // 釣り小屋 → 北の通り
      K.path(g, [[7, 22], [7, 26]], ',', 2);                      // 宿 → 通り
      K.path(g, [[14, 22], [14, 26]], ',', 2);                    // ブレンダ? の家 → 通り（年寄りの家 B）
      K.path(g, [[8, 29], [8, 30]], ',', 2);                      // 通り → 道具屋
      K.path(g, [[15, 29], [15, 30]], ',', 2);
      K.path(g, [[8, 36], [8, 38]], ',', 2);                      // 道具屋 → そり犬の小屋
      K.path(g, [[39, 29], [39, 30]], ',', 2);                    // 通り → 狩人の家
      K.path(g, [[39, 36], [39, 41]], ',', 2);                    // 狩人の家 → 秘密基地
      K.path(g, [[43, 43], [47, 43]], ',', 2);                    // → 分室の空き家
      K.path(g, [[48, 29], [48, 38]], ',', 2);
      K.rect(g, 31, 2, 3, 3, 'p');                                // 見張り台（板の床）
      K.path(g, [[30, 3], [30, 5]], ',', 1);
      // 雪の土手のふちを少しやわらげる（通りの角が丸くなる）
      K.soften(g, '#', '.,c', ['.', '#'], 0.25, 'yule');
      // 秘密基地（雪の土手をくりぬいた入口。戸は見えている。町なので隠し通路にはしない）
      K.rect(g, 36, 38, 5, 3, '#'); K.put(g, 38, 40, '.');

      // ---------------------------------------------------------------- 建物
      const O = [];
      const hall = S.hall('yule_b_hall', 24, 14, { to: { map: 'yule_hall', spawn: 'door' }, sign: 'guild' });
      const inn = S.shop('yule_b_inn', 4, 17, { to: { map: 'yule_inn', spawn: 'door' }, sign: 'inn' });
      const items = S.shop('yule_b_items', 5, 31, { to: { map: 'yule_items', spawn: 'door' }, sign: 'item' });
      const arms = S.shop('yule_b_arms', 45, 12, { to: { map: 'yule_arms', spawn: 'door' }, sign: 'weapon' });
      const jorn = S.house('yule_b_jorn', 37, 5, { to: { map: 'yule_jorn', spawn: 'door' } });
      const sonja = S.house('yule_b_sonja', 45, 5, { to: { map: 'yule_sonja', spawn: 'door' } });
      const eldA = S.house('yule_b_elder', 37, 13, {});
      const eldB = S.house('yule_b_house2', 12, 18, {});
      const marga = S.house('yule_b_brenda', 13, 31, { to: { map: 'yule_brenda', spawn: 'door' } });
      const hunter = S.house('yule_b_hunter', 37, 31, { to: { map: 'yule_hunter', spawn: 'door' } });
      const branch = S.house('yule_b_branch', 46, 39, { to: { map: 'yule_branch', spawn: 'door' }, lamp: false, chimney: false });
      const fish = S.house('yule_b_fish', 15, 12, { to: { map: 'yule_fishhut', spawn: 'door' } });
      O.push(hall, inn, items, arms, jorn, sonja, eldA, eldB, marga, hunter, branch, fish);
      if (night) for (const b of O) if (b.door && b.door.to) delete b.door.to;   // 籠城の夜は家に入らない（守り手は外）
      // 子どもの秘密基地の戸（雪の土手の入口）
      if (!night) O.push({ type: 'door', x: 38, y: 40, to: { map: 'yule_base', spawn: 'door' }, cond: 'snow_base_open' });

      // ---------------------------------------------------------------- 広場の大かまど・祭の飾り
      O.push({ type: 'brazier', id: 'yule_hearth', x: 27, y: 27, on: true });
      O.push(K.prop('firewood', 25, 28), K.prop('firewood', 30, 28), K.exam(28, 28, 'yule_hearth'));
      O.push(K.prop('beacon', 28, 26, { cond: 'cleared_r_snow' }));                // 冬至の火（大灯火の光の柱）
      for (const [x, y] of [[23, 24], [32, 24], [23, 31], [32, 31]]) O.push({ type: 'brazier', id: 'yule_fire_' + x + '_' + y, x, y, on: night || 'snow_festival_lit' });
      // 氷の灯籠（トンネルの入口ごと。WORLD §4.3「町に入ると」）
      for (const [x, y] of [[25, 3], [30, 7], [25, 11], [30, 11], [3, 25], [3, 29], [52, 25], [52, 29], [18, 25], [18, 29], [37, 25], [37, 29],
        [34, 14], [21, 14], [26, 34], [29, 34], [43, 19], [11, 29], [42, 37], [6, 23]]) O.push(K.prop('snow_lamp', x, y));
      for (const [x, y] of [[20, 22], [35, 22], [20, 32], [35, 32], [22, 36], [33, 36], [22, 45], [33, 45]]) O.push(K.prop('ice_crystal', x, y));
      // 広場: 掲示板・行商の屋台・長椅子
      O.push(K.prop('board', 21, 29), K.exam(21, 30, 'yule_board'));
      O.push(K.prop('stall', 34, 29, { cond: '!snow_gate_n_broken' }), K.prop('crate', 35, 30), K.prop('snow_barrel', 34, 31));
      O.push(K.prop('bench', 24, 32), K.prop('bench', 31, 32), K.prop('lantern', 27, 23), K.prop('lantern', 29, 23));
      O.push(K.sign(30, 35, 'ユール――雪のトンネルの村\n冬至に、火と物語を峰へ'));
      // 北: 凍った池と釣り
      for (const [x, y] of [[8, 7], [12, 9], [16, 6]]) O.push(K.prop('ice_hole', x, y));
      O.push(K.exam(12, 8, 'yule_pond'), K.prop('sled', 9, 11), K.prop('snow_barrel', 19, 11));
      O.push(K.prop('ice_crystal', 6, 10), K.exam(7, 10, 'snow_mat', { mat: 'snow_mat_ice' }));                 // 雪像の飾り: 澄んだ氷のかけら
      // 見張り台
      O.push(K.prop('lamp_post', 33, 2), K.prop('crate', 31, 4), K.prop('snow_fence', 34, 4));
      O.push(K.exam(28, 1, 'yule_north_gate'));
      // そり犬の小屋
      O.push(K.prop('hay_sled', 5, 40), K.prop('sled', 9, 40), K.prop('sled', 11, 43), K.prop('hay', 4, 44), K.prop('snow_fence', 3, 46), K.prop('snow_fence', 4, 46), K.prop('snow_fence', 5, 46),
        K.prop('firewood', 12, 39), K.prop('snow_barrel', 13, 45));
      // 雪像の庭（依頼の像。作ったら見た目が変わる）
      O.push(K.exam(27, 40, 'yule_snowman'), K.prop('snow_bank', 24, 38), K.prop('snow_bank', 31, 38), K.prop('snow_bank', 23, 43));
      O.push(K.prop('ice_crystal', 27, 40, { cond: { choice: 'ch_snow_statue', is: 'dragon' } }));
      O.push(K.prop('snow_rock', 27, 40, { cond: { choice: 'ch_snow_statue', is: 'wolf' } }));
      O.push(K.prop('frozen_well', 27, 40, { cond: { choice: 'ch_snow_statue', is: 'hearth' } }));
      // 家まわりの小物（固めて置き、通りの真ん中は空ける）
      O.push(K.prop('firewood', 42, 6), K.prop('snow_barrel', 36, 5), K.prop('stove_pipe', 50, 6), K.prop('snow_barrel', 50, 17), K.prop('firewood', 44, 16),
        K.prop('snow_barrel', 3, 22), K.prop('firewood', 10, 22), K.prop('snow_barrel', 11, 35), K.prop('firewood', 18, 34), 
        K.prop('snow_rock', 51, 42), K.prop('snow_fence', 51, 39), K.prop('snow_fence', 51, 40), K.prop('crate', 20, 12),
        K.prop('snow_barrel', 42, 13), K.prop('firewood', 21, 20), K.prop('snow_barrel', 34, 20));
      // 焼けた北門の柱（戦の傷 lo_war_snow）
      O.push(K.exam(25, 1, 'yule_burnt_gate'));
      // 町の宝箱（見える物だけ）
      O.push(K.chest('yule_c1', 50, 8, { pool: 'p_T' }), K.chest('yule_c2', 4, 44, { item: 'i_firepot', n: 2 }));
      // 雪のもみ（庭のすみ）
      for (const [x, y] of [[21, 38], [34, 40], [3, 38], [14, 46], [44, 45], [52, 45], [52, 36], [34, 12], [36, 21], [4, 15], [22, 5], [22, 11]]) {
        if ('.'.includes(K.at(g, x, y))) O.push(K.prop('snow_fir', x, y, { variant: (x + y) % 2 }));
      }

      // ---------------------------------------------------------------- 籠城のしるし（夜の版）と、破られた門の跡（昼の版）
      if (night) {
        for (const x of [26, 29]) O.push(K.prop('snow_fence', x, 4));
        for (const y of [26, 28]) { O.push(K.prop('snow_fence', 4, y)); O.push(K.prop('snow_fence', 51, y)); }
        O.push({ type: 'brazier', id: 'yule_n_gate_fire', x: 26, y: 7, on: true }, { type: 'brazier', id: 'yule_w_gate_fire', x: 6, y: 28, on: true }, { type: 'brazier', id: 'yule_e_gate_fire', x: 49, y: 28, on: true });
      } else {
        const broken = (gate, pts) => pts.forEach(([id, x, y]) => O.push(K.prop(id, x, y, { cond: 'snow_gate_' + gate + '_broken', variant: (x + y) % 2 })));
        broken('n', [['log', 25, 5], ['crate', 30, 6], ['snow_barrel', 24, 8]]);
        broken('w', [['log', 4, 24], ['crate', 5, 30], ['snow_bank', 6, 24]]);
        broken('e', [['log', 50, 24], ['crate', 51, 30], ['snow_bank', 49, 30]]);
        // 守りきった門の家から礼（二日目。ティア宝箱）
        O.push(K.chest('yule_thanks_n', 29, 10, { pool: 'p_T', cond: ['snow_day2', '!snow_gate_n_broken'] }));
        O.push(K.chest('yule_thanks_w', 4, 28, { pool: 'p_T', cond: ['snow_day2', '!snow_gate_w_broken'] }));
        O.push(K.chest('yule_thanks_e', 51, 28, { pool: 'p_T', cond: ['snow_day2', '!snow_gate_e_broken'] }));
      }

      // 人のまわりに物を置かない・戸口と通りは空ける
      const keep = new Set();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (',c'.includes(K.at(g, x, y))) keep.add(x + ',' + y);
      for (const o of O) if (o.type === 'building' && o.door) for (let dy = 0; dy <= 2; dy++) keep.add(o.door.x + ',' + (o.door.y + dy));
      K.scatter(g, O, ['snow_rock', 'snow_bank'], 10, [2, 2, 52, 46], '.', 'ydeco', { keep, gap: 5, variant: true });
      return { g, O };
    }

    // ---------------------------------------------------------------- 人（昼）
    const DAY = [
      K.npc('jorn', 'npc_jorn', 29, 22, { name: 'ヨルン', title: 'ユールの村長', dir: 's', talk: 'yule_jorn', reward: 'lead', pushable: false }),
      K.npc('sonja', 'npc_sonja', 26, 29, { name: 'ソーニャ', title: '火守りの娘', dir: 'n', talk: 'yule_sonja', reward: 'lead' }),
      K.npc('hald', 'npc_hald', 32, 3, { name: 'ハルド', title: '見張りの老人', dir: 'n', talk: 'yule_hald', reward: 'lead', pushable: false }),
      K.npc('fine', 'fine', 31, 2, { name: '灰色のマントの少女', dir: 'n', talk: [L('……')], cond: ['snow_siege_done', '!snow_fine_seen'], reward: null, pushable: false }),
      K.npc('watch_e', 'npc_snow_watch', 50, 27, { name: '見張りの若者', dir: 'w', talk: 'yule_watch_e', reward: 'boss' }),
      K.npc('sled_man', 'npc_snow_man', 8, 42, { name: 'ニルス', title: 'そり犬の世話係', dir: 'e', talk: 'yule_sled', reward: 'side' }),
      K.npc('sled_dog', 'ani_dog', 6, 43, { name: 'そり犬', dir: 'e', talk: 'yule_dog', cond: 'snow_dog_home', reward: null }),
      K.npc('sculptor', 'npc_snow_woman', 26, 38, { name: 'リーサ', title: '雪像づくりの娘', dir: 's', talk: 'yule_sculptor', reward: 'side' }),
      K.npc('base_kid', 'npc_snow_child', 38, 41, { name: 'ペッカ', title: '秘密基地の番', dir: 's', talk: 'yule_base_kid', reward: 'side', pushable: false, cond: '!snow_base_open' }),
      K.npc('kid_a', 'npc_snow_child', 24, 26, { name: '村の子', dir: 'e', move: 'wander', talk: 'yule_kid_a', reward: 'hint' }),
      K.npc('kid_b', 'npc_snow_child', 33, 40, { name: '村の子', dir: 'w', talk: 'yule_kid_b', reward: 'hint' }),
      K.npc('soup_woman', 'npc_snow_woman', 20, 27, { name: 'スープ売りのおかみ', dir: 'e', talk: 'yule_soup', reward: 'item' }),
      K.npc('fur_peddler', 'npc_merchant_2', 34, 28, { name: '毛皮の行商', dir: 's', talk: 'yule_fur', reward: null, pushable: false, cond: '!snow_gate_n_broken' }),
      K.npc('traveler', 'npc_traveler', 11, 27, { name: '旅の商人', dir: 's', talk: 'yule_traveler', reward: 'lead' }),
      K.npc('tadeo', 'npc_oil_carrier', 46, 27, { name: 'タデオ', title: '灯守組合の油売り', dir: 's', talk: 'yule_tadeo', reward: 'news' }),
      K.npc('villager_m', 'npc_snow_man', 40, 22, { name: '薪割りの男', dir: 'w', talk: 'yule_woodsman', reward: 'lead' }),
      K.npc('old_m', 'npc_snow_old_m', 15, 22, { name: '村の年寄り', dir: 's', talk: 'yule_oldman', reward: 'news' }),
      K.npc('scribe', 'npc_scribe', 44, 43, { name: '記録院の書記', dir: 'e', talk: 'yule_scribe', reward: 'news', cond: { tier: { gte: 4 } } }),
      // 空気だけ（4 人まで）
      K.npc('dog', 'ani_dog', 30, 42, { name: '犬', dir: 'w', move: 'wander', talk: [L('ワフッ！　ワン！')], reward: null }),
      K.npc('child_c', 'npc_snow_child', 44, 19, { name: '村の子', dir: 's', move: 'wander', talk: [L('雪のトンネルはね、\n走るとすべるの。\n……でも走るの！'), L('cleared_r_snow', '吹雪がやんだら、\n空がこんなに広かったんだ！')], reward: null }),
      K.npc('woman_b', 'npc_snow_woman', 9, 16, { name: '宿の前の女', dir: 's', talk: [L('祭の支度で、どの家も\n獣脂を大かまどへ運んでるの。\nうちの灯りも、今夜は細いわ。'), L('cleared_r_snow', '冬至の火のおかげで、\n今年は脂を配り直せるわ。')], reward: null }),
    ];
    // 籠城の夜（守り手だけ）
    const NIGHT = [
      K.npc('jorn', 'npc_jorn', 27, 25, { name: 'ヨルン', title: 'ユールの村長', dir: 's', talk: 'yule_siege_jorn', pushable: false }),
      K.npc('sonja', 'npc_sonja', 28, 29, { name: 'ソーニャ', title: '火守りの娘', dir: 'n', talk: 'yule_siege_sonja', pushable: false }),
      K.npc('hald', 'npc_hald', 27, 5, { name: 'ハルド', title: '見張りの老人', dir: 'n', talk: 'yule_siege_hald', pushable: false }),
      K.npc('guard_w', 'npc_snow_man', 5, 27, { name: '村の猟師', dir: 'w', talk: 'yule_siege_guard', pushable: false }),
      K.npc('guard_e', 'npc_snow_watch', 50, 27, { name: '見張りの若者', dir: 'e', talk: 'yule_siege_guard', pushable: false }),
      K.npc('olaf_n', 'npc_snow_old_m', 29, 5, { name: 'オラフ', title: '年寄りの猟師', dir: 'n', talk: 'yule_siege_guard', pushable: false, cond: { choice: 'ch_snow_tale', is: 'hunter' } }),
    ];

    const common = (night) => ({
      kind: 'town', region: 'r_snow', location: 'yule', theme: 'snow_town',
      legend: S.LEGEND(), outside: 'snow',
      spawns: {
        gate_n: { x: 27, y: 2, dir: 's' }, gate_w: { x: 2, y: 27, dir: 'e' }, gate_e: { x: 53, y: 27, dir: 'w' },
        plaza: { x: 27, y: 31, dir: 'n' }, hearth: { x: 27, y: 29, dir: 'n' },
        hall: { x: 28, y: 20, dir: 's' }, inn: { x: 7, y: 22, dir: 's' }, items: { x: 8, y: 36, dir: 's' }, arms: { x: 48, y: 17, dir: 's' },
        jorn: { x: 39, y: 9, dir: 's' }, sonja: { x: 47, y: 9, dir: 's' }, brenda: { x: 15, y: 35, dir: 's' }, hunter: { x: 39, y: 35, dir: 's' },
        branch: { x: 48, y: 43, dir: 's' }, fish: { x: 17, y: 16, dir: 's' }, base: { x: 38, y: 41, dir: 's' }, sled: { x: 9, y: 44, dir: 'n' },
        watch: { x: 30, y: 4, dir: 'n' }, snowman: { x: 27, y: 42, dir: 'n' },
        // 籠城の門（守る門の前）
        def_n: { x: 27, y: 6, dir: 'n' }, def_w: { x: 6, y: 27, dir: 'w' }, def_e: { x: 49, y: 27, dir: 'e' },
      },
      exits: night ? [] : [
        { x: 26, y: 0, w: 4, h: 1, to: { map: 'world', spawn: 'yule_n' } },
        { x: 0, y: 26, w: 1, h: 3, to: { map: 'world', spawn: 'yule_w' } },
        { x: 55, y: 26, w: 1, h: 3, to: { map: 'world', spawn: 'yule_e' } },
      ],
      zones: [],
      dark: false,
    });

    const D1 = build(false);
    K.def('yule', Object.assign(common(false), {
      name: '雪の村ユール', rows: D1.g, objects: D1.O, npcs: DAY,
      triggers: [{ id: 'arrival', on: 'enter', event: 'yule_arrival' }],
      // 解決の後、雪がゆるむ（土手が低くなって近道が開く）
      tilePatches: [
        { cond: 'cleared_r_snow', rect: [19, 34, 2, 3], rows: ['..', '..', '..'] },
        { cond: 'cleared_r_snow', rect: [35, 34, 3, 2], rows: ['...', '...'] },
      ],
      light: { ambient: '#5a66a8', k: 0.5, poolK: 0.8, spillR: 0.9, mood: 'town_night' },
      bgm: 'yule', weather: 'snow', weatherCond: '!cleared_r_snow',
      meta: { sub: '雪のトンネルの村', chestsInfo: false },
    }));
    const D2 = build(true);
    K.def('yule_night', Object.assign(common(true), {
      name: '雪の村ユール', rows: D2.g, objects: D2.O, npcs: NIGHT,
      triggers: [],
      light: { ambient: '#3e4684', k: 0.42, poolK: 1.1, spillR: 1.1, mood: 'town_night' },
      bgm: 'siege', weather: 'blizzard',
      meta: { sub: '籠城の夜', chestsInfo: false, noWarp: true },
    }));
  });
})(window.RPG);
