// CONTENT（灰の荒野）: 灰の火山（ash_volcano_1 1 階・ash_volcano_2 火口）。WORLD_REDESIGN §4.7・§6.4（溶岩の流れ）・§6.5、STORY_BIBLE §7.7、v1 region7_volcano.js。
//   入口は町の東の火山のふもとの岩戸（大会の勝者だけ。族長ドルガが開ける）。
//   1 階 56×48: 南の入口の広間 → 西の溶岩の川（A）の向こうに壁画 1、北の溶岩の川（B）の向こうに大きな洞。
//            溶岩の堰の石のレバー（広間と北の洞に 1 つずつ）を引くと、流れが A と B の間で入れ替わる（2 通りの tilePatches。どちらかの川の渡り場が冷えた殻になる）。
//            北の洞: 東の部屋で炎の番犬（中ボス tr_b_hellhound、壁画 2 の前）、西の部屋に壁画 3（記録院の写し手が来る所）、北に火口への岩戸（鳥の形のくぼみが 3 つ）。
//            壁画は好きな順。3 つ読むと岩戸が開く（ash_murals ≥ 3）。
//   火口 44×36: 南の石段 → 火口の内壁の岩棚の道 → 北の縁（フィーネ）→ 溶岩の湖の中の島（卵）へ黒い石の土手道。土手道で溶岩の巨獣（地方ボス tr_b_lavabeast）。
//   泉は置かない（火山は 2 階の短いダンジョン。WORLD §6.2、持ち主の決まり「泉は少なく」）。隠し通路なし。
//   どちらの階も 1 枚の下絵（v2/assets/env/ash/under/ash_volcano_1*・ash_volcano_2*）。1 階の絵は両方の渡り場が冷えた形で描き、
//   流れている方の渡り場は閉じた絵（ash_volcano_1_closed、溶岩）をそのマスに置く（art.closed・meta.live。ENV_ASSETS.md §8）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, AK = R.Ash.kit, L = K.L;
    const blob = (g, cx, cy, rx, ry, ch, seed, only) => {
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const wob = (((x * 17 + y * 31 + seed * 7) % 9) / 9 - 0.5) * 0.3;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + wob && (!only || only.includes(K.at(g, x, y)))) K.put(g, x, y, ch);
      }
    };

    // ================================================================ 1 階
    {
      const W = 56, H = 48;
      const g = K.grid(W, H, '#');
      // 入口の広間（X）
      blob(g, 28, 40, 8, 5, '.', 1);
      K.rect(g, 26, 44, 4, 4, '.');
      // 西の部屋（Z、壁画 1）: 北の壁は平ら（壁画を描く面）
      K.rect(g, 5, 34, 10, 9, '.'); blob(g, 9, 40, 5, 4, '.', 2);
      // 北の大きな洞（Y）: まん中の広間・東の部屋（番犬・壁画 2）・西の部屋（壁画 3）・北の通路（岩戸）
      blob(g, 28, 23, 9, 6, '.', 3);
      K.rect(g, 41, 12, 11, 12, '.'); blob(g, 46, 20, 6, 5, '.', 4);
      K.rect(g, 5, 12, 12, 11, '.'); blob(g, 10, 19, 6, 5, '.', 5);
      K.rect(g, 26, 6, 4, 12, '.');
      blob(g, 28, 6, 5, 3, '.', 6);
      K.rect(g, 36, 20, 6, 3, '.');                  // まん中 → 東の部屋
      K.rect(g, 16, 20, 5, 3, '.');                  // まん中 → 西の部屋
      // 黒曜石の床（東の部屋の奥・岩戸の前）
      blob(g, 48, 15, 3, 2.5, 'o', 7, ['.']);
      blob(g, 28, 5, 3, 1.6, 'o', 8, ['.']);
      // 溶岩の川 A（西。Z と X の間を南北に流れる）と、渡り場
      for (let y = 29; y <= 47; y++) for (let x = 16; x <= 18; x++) K.put(g, x, y, '%');
      K.rect(g, 13, 39, 3, 3, '.'); K.rect(g, 19, 39, 2, 3, '.');   // 渡り場の両岸
      // 溶岩の川 B（北。X と Y の間を東西に流れる）と、渡り場
      for (let y = 31; y <= 32; y++) for (let x = 12; x <= 46; x++) K.put(g, x, y, '%');
      K.rect(g, 26, 29, 4, 2, '.'); K.rect(g, 26, 33, 4, 3, '.');   // 渡り場の両岸
      // 溶岩の池（景色。通れない）
      blob(g, 28, 22, 2.5, 1.6, '%', 9, ['.']);
      blob(g, 44, 22, 2, 1.4, '%', 10, ['.']);
      blob(g, 35, 41, 1.8, 1.3, '%', 12, ['.']);
      // 渡り場（地面は冷えた殻 'k'。流れている方の渡り場を tilePatches で溶岩 '%' にする = cond の無い形はどちらも渡れる）
      const crossA = [], crossB = [];
      for (let y = 39; y <= 41; y++) for (let x = 16; x <= 18; x++) crossA.push([x, y]);
      for (let y = 31; y <= 32; y++) for (let x = 27; x <= 28; x++) crossB.push([x, y]);
      const patch = (cells) => {
        const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
        const rows = [];
        for (let y = y0; y <= y1; y++) { let s = ''; for (let x = x0; x <= x1; x++) s += cells.some((c) => c[0] === x && c[1] === y) ? '%' : ' '; rows.push(s); }
        return { rect: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], rows };
      };
      const pA = patch(crossA), pB = patch(crossB);
      for (const [x, y] of crossA.concat(crossB)) g[y][x] = 'k';
      const O = [];
      // 溶岩の堰のレバー（広間 = L1、北の洞 = L2）。引くたびに流れが入れ替わる
      for (const [n, x, y] of [[1, 32, 37], [2, 33, 25]]) {
        O.push(K.prop('lever', x, y, { cond: '!ash_sluice' }), K.prop('lever', x, y, { frame: 'on', cond: 'ash_sluice' }), K.exam(x, y, 'volcano_sluice', { lever: n }));
      }
      // 壁画 3 つ（北の壁の前に立って調べる。絵は下絵の壁に描いてある）
      O.push(K.exam(9, 33, 'volcano_mural', { mural: 1 }), K.exam(10, 33, 'volcano_mural', { mural: 1 }));
      O.push(K.exam(47, 11, 'volcano_mural', { mural: 2 }), K.exam(48, 11, 'volcano_mural', { mural: 2 }));
      O.push(K.exam(10, 11, 'volcano_mural', { mural: 3 }), K.exam(11, 11, 'volcano_mural', { mural: 3 }));
      // 火口への岩戸（ash_murals ≥ 3 で開く階段。閉じている間は調べる）
      O.push(K.stairs(28, 3, { map: 'ash_volcano_2', spawn: 'stairs' }, { id: 'volcano_1_up', look: 'up', cond: { var: 'ash_murals', gte: 3 } }));
      O.push(K.exam(28, 3, 'volcano_rockdoor', { cond: { not: { var: 'ash_murals', gte: 3 } } }));
      // 宝箱（見える所）
      O.push(K.chest('volcano_1_c1', 5, 42, { pool: 'p_T' }), K.chest('volcano_1_c2', 13, 35, { item: 'i_ether', n: 2 }),
        K.chest('volcano_1_c3', 51, 23, { pool: 'p_rare' }), K.chest('volcano_1_c4', 5, 22, { pool: 'p_T' }), K.chest('volcano_1_c5', 22, 42, { gold: 420 }),
        K.chest('volcano_1_c6', 51, 12, { item: 'i_panacea', n: 2 }));
      // 光: 溶岩の照り返し（光だけ。溶岩のマスの上）。かがり火は置かない（溶岩が照らす）
      for (const [x, y] of [[17, 34], [17, 45], [20, 31], [38, 32], [28, 22], [44, 22], [35, 41], [13, 31]]) O.push(K.prop('lava_glow', x, y));
      O.push(K.sign(30, 44, '――灰の火山。\n火の鳥の眠る山。\n試練の勝者のほか、入るべからず。'));
      K.def('ash_volcano_1', {
        name: '灰の火山', kind: 'dungeon', region: 'r_ash', location: 'volcano', theme: 'cave',
        legend: AK.VOLCANO(), rows: g, outside: 'wall_cave',
        objects: O,
        npcs: [
          K.npc('copyist_a', 'npc_scribe', 9, 13, { name: '記録院の写し手', dir: 'n', talk: [L('……。')], cond: ['ash_copyists', '!ash_copy_done'] }),
          K.npc('copyist_b', 'npc_scribe', 12, 13, { name: '記録院の写し手', dir: 'n', talk: [L('……。')], cond: ['ash_copyists', '!ash_copy_done'] }),
        ],
        spawns: { entrance: { x: 27, y: 45, dir: 'n' }, stairs: { x: 28, y: 5, dir: 's' } },
        exits: [{ x: 26, y: 47, w: 4, h: 1, to: { map: 'world', spawn: 'volcano' } }],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'volcano_arrive' },
          { id: 'hound', x: 39, y: 20, w: 2, h: 3, on: 'step', event: 'volcano_hound', cond: '!ash_hound' },
          { id: 'copy', x: 16, y: 20, w: 2, h: 3, on: 'step', event: 'volcano_copyists', cond: ['ash_champion', '!ash_copy_done'] },
        ],
        // 堰を引いた後（ash_sluice）は西の渡り場 A が流れ、引く前は北の渡り場 B が流れる
        tilePatches: [
          { cond: 'ash_sluice', rect: pA.rect, rows: pA.rows },
          { cond: '!ash_sluice', rect: pB.rect, rows: pB.rows },
        ],
        zones: [{ rect: [0, 0, 56, 48], zone: 'z_ash_volcano' }],
        light: AK.LIGHT_VOLCANO, dark: false,
        bgm: 'cave', bbg: 'ash',
        meta: { chestsInfo: true, floor: '1階', sub: '溶岩の流れる洞', live: [{ cells: crossA, cond: '!ash_sluice' }, { cells: crossB, cond: 'ash_sluice' }] },
        // 1 枚の下絵（両方の渡り場が冷えた形）。流れている方の渡り場は閉じた絵（溶岩）をそのマスに置く。壁画・岩戸・溶岩は絵、lava_glow は光だけ
        art: { image: 'ash/under/ash_volcano_1', closed: 'ash/under/ash_volcano_1_closed', emit: 'ash/under/ash_volcano_1_emit', painted: ['lava_glow'] },
      });
    }

    // ================================================================ 火口
    {
      const W = 44, H = 36;
      const g = K.grid(W, H, '#');
      // 溶岩の湖（火口の底）
      blob(g, 22, 17, 13, 9, '%', 21);
      // 火口の内壁の岩棚の道（南 → 西 → 北の縁）
      K.rect(g, 19, 30, 6, 5, '.');                 // 南の石段の前
      K.rect(g, 6, 29, 14, 3, '.');                 // 南の棚（西へ）
      K.rect(g, 4, 8, 3, 23, '.');                  // 西の棚（北へ）
      K.rect(g, 4, 5, 18, 3, '.');                  // 北の縁（東へ）
      K.rect(g, 21, 3, 12, 4, 'o');                 // 北の縁の広い所（フィーネの立つ所）
      blob(g, 30, 30, 5, 2.2, '.', 22);             // 南東の岩棚（宝箱）
      K.rect(g, 25, 30, 3, 2, '.');
      blob(g, 38, 12, 3, 5, '.', 23);               // 東の岩棚（宝箱。北の縁から）
      K.rect(g, 33, 4, 4, 3, 'o');
      K.rect(g, 35, 6, 3, 3, '.');
      // 卵の島と、北の縁からの黒い石の土手道
      blob(g, 22, 17, 4.2, 3.2, 'o', 24);
      K.rect(g, 21, 7, 2, 8, '.');
      const O = [];
      O.push(K.stairs(21, 34, { map: 'ash_volcano_1', spawn: 'stairs' }, { id: 'volcano_2_down', look: 'down' }));
      for (const [x, y] of [[21, 16], [22, 16], [21, 17], [22, 17]]) K.put(g, x, y, 'X');   // 卵（描いた物）
      O.push(K.exam(21, 16, 'ash_crater_egg'), K.exam(22, 16, 'ash_crater_egg'));
      O.push(K.chest('volcano_2_c1', 33, 30, { pool: 'p_rare' }), K.chest('volcano_2_c2', 39, 12, { item: 'i_elixir', n: 1 }), K.chest('volcano_2_c3', 5, 9, { pool: 'p_T' }));
      for (const [x, y] of [[12, 12], [32, 12], [14, 22], [30, 22], [22, 25], [10, 17], [34, 17]]) O.push(K.prop('lava_glow', x, y));
      K.def('ash_volcano_2', {
        name: '灰の火山', kind: 'dungeon', region: 'r_ash', location: 'volcano', theme: 'cave',
        legend: AK.VOLCANO(), rows: g, outside: 'wall_cave',
        objects: O,
        npcs: [
          K.npc('fine', 'fine', 27, 4, { name: '灰色のマントの少女', dir: 's', talk: 'ash_crater_fine', reward: null, pushable: false, cond: ['ash_lavabeast', '!ash_fine_seen'] }),
        ],
        spawns: { stairs: { x: 21, y: 32, dir: 'n' }, rim: { x: 22, y: 5, dir: 's' }, egg: { x: 22, y: 15, dir: 's' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'ash_crater_arrive', once: true },
          { id: 'beast', x: 21, y: 9, w: 2, h: 3, on: 'step', event: 'ash_crater_beast', cond: '!ash_lavabeast' },
        ],
        zones: [{ rect: [16, 3, 12, 14], zone: null }, { rect: [0, 0, 44, 36], zone: 'z_ash_crater' }].filter((z) => z.zone),
        light: AK.LIGHT_VOLCANO, dark: false,
        bgm: 'cave', bbg: 'ash',
        meta: { chestsInfo: true, floor: '火口', sub: '火の鳥の卵の眠る所' },
        // 1 枚の下絵（溶岩の湖・岩棚・土手道・卵の島と卵）。lava_glow は光だけ
        art: { image: 'ash/under/ash_volcano_2', emit: 'ash/under/ash_volcano_2_emit', painted: ['lava_glow'] },
      });
    }
  });
})(window.RPG);
