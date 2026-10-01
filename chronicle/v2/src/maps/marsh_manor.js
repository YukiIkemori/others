// CONTENT（湿原）: 霧の館（marsh_manor_1 1 階・marsh_manor_2 2 階）。WORLD_REDESIGN §4.4・§6.5、STORY_BIBLE §7.4、v1 region4_manor.js。
//   1 階 48×40: 南の玄関 → 玄関の広間 → 中庭（枯れた噴水）→ 北の大広間（2 階への大階段）。西に食堂と書庫、東に台所と割れた温室。
//             書庫の楽譜の書き付けに、オルゴールを回す順（弦・笛・太鼓）がある（2 階の小さな遊び）。
//   2 階 48×36: 大階段の踊り場 → 長い回廊 → 北の音楽室（人形の楽団 tr_b_dolls）→ 奥のメルダの部屋（鐘の鍵と鐘の歌、証拠 5）。
//             西の子ども部屋・南の寝室 2 つ。寝室と子ども部屋のオルゴール 3 つを順に回すと、回廊の飾り棚の隠し箱が開く（任意）。
//   泉は置かない（館は 2 階。WORLD §6.2）。隠し通路なし。どちらの階も 1 枚の下絵（v2/assets/env/lighthouse/under/manor_1*・manor_2*）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Marsh.kit;

    // ================================================================ 1 階
    {
      const W = 48, H = 40;
      const g = K.grid(W, H, '#');
      K.rect(g, 16, 29, 16, 8, '.');      // 玄関の広間
      K.rect(g, 22, 30, 4, 7, 'c');
      K.rect(g, 22, 37, 4, 3, '.');       // 玄関のポーチ（外へ）
      K.rect(g, 3, 29, 12, 8, 'w');       // 食堂
      K.rect(g, 15, 32, 1, 2, '.');       // 広間 ↔ 食堂
      K.rect(g, 3, 17, 12, 10, 'w');      // 書庫
      K.rect(g, 7, 27, 2, 2, 'w');        // 食堂 ↔ 書庫
      K.rect(g, 33, 29, 12, 8, '.');      // 台所
      K.rect(g, 32, 32, 1, 2, '.');       // 広間 ↔ 台所
      K.rect(g, 33, 17, 12, 10, 'g');     // 割れた温室（草と小さな池）
      K.rect(g, 38, 27, 2, 2, '.');       // 台所 ↔ 温室
      K.rect(g, 36, 20, 4, 3, '~');
      K.rect(g, 16, 16, 16, 11, 'g');     // 中庭
      K.rect(g, 22, 27, 4, 2, '.');       // 広間 → 中庭
      K.rect(g, 15, 21, 1, 2, 'w');       // 中庭 ↔ 書庫
      K.rect(g, 32, 21, 1, 2, '.');       // 中庭 ↔ 温室
      K.rect(g, 22, 19, 4, 4, 'X');       // 枯れた噴水（描いた物）
      for (const [x, y] of [[17, 17], [18, 17], [29, 17], [30, 17], [17, 25], [30, 25]]) K.put(g, x, y, 'h');   // 生け垣の角
      K.rect(g, 3, 3, 42, 11, '.');       // 北の大広間
      K.rect(g, 22, 4, 4, 9, 'c');
      K.rect(g, 22, 14, 4, 2, '.');       // 中庭 → 大広間
      K.rect(g, 8, 14, 2, 2, 'w');        // 書庫 ↔ 大広間
      K.rect(g, 21, 3, 6, 1, '#');        // 大階段の両脇の手すり（上の段は描いた階段）
      K.put(g, 23, 3, 'c'); K.put(g, 24, 3, 'c');
      const O = [];
      O.push(K.stairs(23, 3, { map: 'marsh_manor_2', spawn: 'stairs' }, { id: 'manor_1_up', look: 'up' }));
      // 宝箱（見える所）
      O.push(K.chest('manor_1_c1', 4, 18, { pool: 'p_T' }), K.chest('manor_1_c2', 13, 35, { item: 'i_potion', n: 3 }),
        K.chest('manor_1_c3', 43, 18, { pool: 'p_T' }), K.chest('manor_1_c4', 4, 4, { pool: 'p_rare' }), K.chest('manor_1_c5', 43, 35, { gold: 320 }));
      // 調べる物: 書庫の楽譜の書き付け・大広間の肖像画・中庭の噴水・食堂の食卓
      O.push(K.prop('bookshelf', 10, 17), K.prop('bookshelf', 11, 17), K.exam(10, 18, 'manor_sheet'));
      O.push(K.exam(30, 3, 'manor_portrait'));
      O.push(K.exam(24, 23, 'manor_fountain'));
      O.push(K.prop('dining_table', 8, 32, { w: 2 }), K.exam(8, 33, 'manor_dining'));
      // 燭台（部屋の隅。通り道に置かない）
      for (const [x, y] of [[3, 29], [14, 29], [16, 29], [31, 29], [33, 36], [3, 13], [44, 13], [44, 3]]) O.push(K.prop('candelabra', x, y));
      O.push(K.sign(21, 36, R.T('map.marsh_manor.sign')));
      K.def('marsh_manor_1', {
        name: R.T('map.marsh_manor.marsh_manor_1.name'), kind: 'dungeon', region: 'r_marsh', location: 'manor', theme: 'lighthouse',
        legend: MK.MANOR(), rows: g, outside: 'wall_stone',
        objects: O, npcs: [],
        spawns: { entrance: { x: 23, y: 37, dir: 'n' }, stairs: { x: 23, y: 5, dir: 's' } },
        exits: [{ x: 22, y: 39, w: 4, h: 1, to: { map: 'world', spawn: 'manor' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'manor_arrive', once: true }],
        zones: [{ rect: [0, 0, 48, 36], zone: 'z_marsh_manor' }],
        light: MK.LIGHT_MANOR, dark: false,
        bgm: 'ghost', bbg: 'manor',
        meta: { chestsInfo: true, floor: R.T('map.marsh_manor.marsh_manor_1.meta.floor'), sub: R.T('map.marsh_manor.marsh_manor_1.meta.sub') },
        art: { image: 'lighthouse/under/manor_1', painted: [] },
      });
    }

    // ================================================================ 2 階
    {
      const W = 48, H = 36;
      const g = K.grid(W, H, '#');
      K.rect(g, 19, 28, 10, 6, '.');      // 大階段の踊り場
      K.rect(g, 3, 22, 42, 4, 'c');       // 長い回廊（じゅうたん）
      K.rect(g, 22, 26, 4, 2, '.');       // 踊り場 → 回廊
      K.rect(g, 3, 28, 13, 6, 'w');       // 南西の寝室
      K.rect(g, 8, 26, 2, 2, 'w');
      K.rect(g, 32, 28, 13, 6, 'w');      // 南東の寝室
      K.rect(g, 38, 26, 2, 2, 'w');
      K.rect(g, 14, 6, 20, 12, 'w');      // 北の音楽室
      K.rect(g, 22, 18, 4, 4, 'w');       // 回廊 → 音楽室
      K.rect(g, 16, 7, 16, 3, 'c');       // 楽団の舞台
      K.rect(g, 36, 6, 9, 12, 'c');       // メルダの部屋（音楽室の奥）
      K.rect(g, 34, 11, 2, 3, 'w');       // 音楽室 → メルダの部屋
      K.rect(g, 3, 6, 9, 12, 'w');        // 北西の子ども部屋
      K.rect(g, 6, 18, 2, 4, 'w');        // 回廊 → 子ども部屋
      const O = [];
      O.push(K.stairs(23, 33, { map: 'marsh_manor_1', spawn: 'stairs' }, { id: 'manor_2_down', look: 'down' }));
      // オルゴール 3 つ（弦・笛・太鼓の順に回す。任意）と、回廊の飾り棚の隠し箱
      O.push(K.prop('cupboard', 4, 28), K.exam(4, 29, 'manor_musicbox', { box: 'strings' }));
      O.push(K.prop('cupboard', 44, 28), K.exam(44, 29, 'manor_musicbox', { box: 'flute' }));
      O.push(K.prop('cupboard', 4, 6), K.exam(4, 7, 'manor_musicbox', { box: 'drum' }));
      O.push(K.chest('manor_2_box', 30, 22, { pool: 'p_rare', cond: 'marsh_boxes_done' }));
      // 宝箱（見える所）
      O.push(K.chest('manor_2_c1', 15, 33, { pool: 'p_T' }), K.chest('manor_2_c2', 43, 33, { item: 'i_ether', n: 2 }), K.chest('manor_2_c3', 11, 7, { pool: 'p_T' }));
      // 調べる物: 音楽室の譜面台・メルダの部屋の鏡台
      O.push(K.exam(24, 12, 'manor_stand'));
      O.push(K.prop('dresser', 43, 7), K.exam(43, 8, 'manor_mirror'));
      for (const [x, y] of [[3, 25], [44, 25], [19, 28], [28, 28], [14, 17], [33, 17], [36, 17], [44, 17]]) O.push(K.prop('candelabra', x, y));
      O.push(K.sign(26, 27, R.T('map.marsh_manor.sign_2')));
      K.def('marsh_manor_2', {
        name: R.T('map.marsh_manor.marsh_manor_2.name'), kind: 'dungeon', region: 'r_marsh', location: 'manor', theme: 'lighthouse',
        legend: MK.MANOR(), rows: g, outside: 'wall_stone',
        objects: O,
        npcs: [
          K.npc('melda', 'npc_melda', 40, 9, { name: R.T('map.marsh_manor.marsh_manor_2.npcs.0.melda.name'), title: R.T('map.marsh_manor.marsh_manor_2.npcs.0.melda.title'), dir: 's', talk: 'manor_melda', reward: 'lead', pushable: false, cond: ['marsh_dolls', '!marsh_melda_gone'] }),
        ],
        spawns: { stairs: { x: 23, y: 31, dir: 'n' }, melda: { x: 40, y: 12, dir: 'n' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'manor_2_arrive', once: true },
          { id: 'band', x: 16, y: 11, w: 16, h: 3, on: 'step', event: 'manor_band', cond: '!marsh_dolls' },
          { id: 'melda', x: 36, y: 10, w: 2, h: 5, on: 'step', event: 'manor_melda', cond: ['marsh_dolls', '!marsh_melda_met'] },
        ],
        zones: [{ rect: [0, 18, 48, 18], zone: 'z_marsh_manor' }],
        light: MK.LIGHT_MANOR, dark: false,
        bgm: 'ghost', bbg: 'manor',
        meta: { chestsInfo: true, floor: R.T('map.marsh_manor.marsh_manor_2.meta.floor'), sub: R.T('map.marsh_manor.marsh_manor_2.meta.sub') },
        art: { image: 'lighthouse/under/manor_2', painted: [] },
      });
    }
  });
})(window.RPG);
