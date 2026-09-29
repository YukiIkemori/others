// CONTENT-F: 千年樹 2 階（elder_2）根の間。V2_PLAN §3.2・§3.3 F11・WORLD_REDESIGN §4.1・§6・STORY_BIBLE §7.1
//   ダンジョン 52×48。上の降り口（幹の芯の穴）→ 東の根 → 根の滑り → 切り口の間 →
//   控えの間（泉・床の大きな年輪 = 伸びない年輪。ピムはここで野営地へ帰る）→ 根の奥の祭壇（根食らい → エルム）。
//   ピムの抜け穴（E7、by:'guest'）: 降り口の広間の穴 → 切り口の間への根の戸（東を回らずに済む近道）。
//   西の根は寄り道（宝箱）。控えの間と西の根は戻り道でつながる（一方通行は置かない。描いた絵に段差が無く、持ち主 2026-09-28「行けるのに戻れない」を不具合と受け取った）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const W = 52, H = 48;
    const g = K.grid(W, H, 'B');

    K.blob(g, 26, 6, 7, 3, 'r', 'e2a');           // R0 降り口の広間
    K.blob(g, 10, 16, 6, 5, 'r', 'e2b');          // R1 西の根（寄り道）
    K.blob(g, 42, 16, 6, 5, 'r', 'e2c');          // R2 東の根
    K.blob(g, 42, 16, 2, 1, '~', 'e2cw', 'r');
    K.blob(g, 26, 22, 6, 3, 'r', 'e2d');          // R3 切り口の間
    K.blob(g, 26, 31, 7, 3, '.', 'e2e');          // R4 控えの間（泉）
    K.blob(g, 26, 41, 9, 4, 'r', 'e2f');          // R5 根の奥の祭壇
    K.blob(g, 26, 42, 3, 2, '.', 'e2f2', 'r');
    K.path(g, [[19, 6], [14, 6], [14, 13]], 'r', 2);            // R0 → R1
    K.path(g, [[33, 6], [38, 6], [38, 14]], 'r', 2);            // R0 → R2
    K.path(g, [[42, 21], [42, 26], [33, 26], [33, 22], [30, 22]], 'r', 2);   // R2 → 根の滑り → R3
    K.path(g, [[26, 10], [26, 19]], 'r', 2);                    // R0 → R3（根の戸）
    K.rect(g, 26, 14, 2, 1, 'G');
    K.path(g, [[26, 25], [26, 28]], '.', 2);                    // R3 → R4
    K.path(g, [[26, 34], [26, 37]], 'r', 2);                    // R4 → R5
    K.path(g, [[10, 21], [10, 30], [19, 30]], 'r', 2);          // R4 → R1 の戻り道（控えの間から西へ下りるだけ）
    // 根のこぶ（R）は置かない。持ち主 2026-09-29「通路をふさぐ変な茶色の歯車みたいな物」: 下絵の根のこぶ（年輪の輪と桃色の根）も消した（elder_fix/clean.py）

    const O = [];
    O.push(K.stairs(22, 5, { map: 'elder_1', spawn: 'up' }, { id: 'elder_2_up', look: 'up' }));
    O.push({ type: 'switch', id: 'elder_2_sw2', x: 29, y: 8, flag: 'forest_sw2', look: 'hole', color: 'teal', by: 'guest' });
    O.push(K.spring('elder_2_s1', 30, 30));                     // 泉（根食らいの手前。千年樹でただ 1 つ。WORLD §6.2）
    O.push(K.exam(24, 22, 'elder_rings'));   // 切り口（調べる所は下の K.moveTo で控えの間の年輪へ。切り口の根の物は通り道をふさぐので置かない 2026-09-29）
    O.push(K.prop('crystal', 26, 44), K.exam(26, 43, 'elder_altar'));  // 根の祭壇
    O.push(K.chest('elder_2_c1', 6, 18, { pool: 'p_T' }));
    O.push(K.chest('elder_2_c2', 46, 13, { pool: 'p_T' }));
    O.push(K.chest('elder_2_c3', 9, 12, { item: 'i_ether', n: 2 }));
    O.push(K.chest('elder_2_c4', 30, 20, { gold: 200 }));
    O.push(K.sign(22, 29, R.T('map.elder_2.sign')));
    for (const [x, y] of [[21, 7], [31, 5], [8, 15], [12, 20], [40, 14], [45, 19], [22, 23], [31, 21], [21, 31], [33, 30], [19, 41], [33, 41], [23, 38], [29, 38]]) O.push(K.prop('mushroom_glow', x, y, { variant: (x * 3 + y) % 4 }));
    K.scatter(g, O, ['rock_small', 'mushroom_glow'], 8, [1, 1, 50, 46], 'r', 'e2rk', { gap: 4, variant: true, keep: new Set(['26,38', '27,38', '26,37', '27,37']) });

    // ---------------------------------------------------------------- 描いた絵に当たりを合わせる（K.fit。絵の床・壁・描き足した大木の所。
    //   手で組んだ上の形は絵の下書き。絵がずれた所だけここで直す。マスの一覧はマップの絵の床の割合から拾い、重ねた当たりの絵で確かめた）
    K.fit(g, {
      r: '23,3 24,3 25,3 26,3 27,3 28,3 29,3 30,3 31,4 14,5 15,5 16,5 17,5 18,5 19,5 32,5 33,5 34,5 35,5 36,5 37,5 38,5 13,9 27,9 8,11 9,11 10,11 11,11 12,11 ' +
        '13,11 40,11 41,11 42,11 43,11 44,11 45,11 7,12 46,12 37,13 47,13 16,16 28,16 41,16 42,16 43,16 16,17 23,19 24,19 25,19 28,19 29,19 31,20 32,21 33,21 ' +
        '35,24 12,25 12,28 28,36 31,44 32,44 23,45 24,45 25,45 26,45 27,45 28,45 29,45 30,45',
      B: '21,5 31,6 32,6 39,6 16,7 17,7 18,7 19,7 20,7 21,7 31,7 33,7 34,7 35,7 36,7 37,7 39,7 22,8 23,8 24,8 25,8 28,8 29,8 30,8 39,8 15,12 6,13 5,14 5,15 5,16 ' +
        '5,17 47,17 5,18 6,18 15,18 26,18 37,18 6,19 46,19 7,20 8,20 9,20 10,20 13,20 22,20 39,20 40,20 41,20 45,20 10,21 21,21 42,21 10,22 21,22 22,22 30,22 ' +
        '31,22 42,22 10,23 22,23 23,23 31,23 32,23 33,23 34,23 42,23 23,24 24,24 25,24 28,24 29,24 30,24 33,24 10,25 33,25 10,26 10,28 10,29 10,30 12,30 32,30 ' +
        '32,31 26,37 21,38 22,38 19,39 20,39 21,39 19,40 20,40 18,41 19,41 34,41 19,42 34,42 19,43 21,43',
      ".": '28,25 25,27 28,28 31,29 28,34',
      "~": '42,15 43,15 44,15',
    }, O);
    // 絵の壁・木に埋まっていた物を床へ（持ち主 2026-09-28「宝箱も壁にめり込んでるのがある」）
    K.moveTo(O, { id: 'elder_2_sw2' }, 29, 7);
    K.moveTo(O, { id: 'elder_2_c1' }, 7, 18);
    // 伸びない年輪（必の読み物）は控えの間の床に描いた大きな年輪の上へ。西の根の戻り道が両向きになったので、
    //   どちらの道で来ても通る控えの間に置く（切り口の間の根は飾りのまま）
    K.moveTo(O, { event: 'elder_rings' }, 26, 31);
    // 2026-09-29 持ち主「壁に沿って・壁の中を歩ける所がある」: 重ねた当たりの絵でもう一度合わせた（壁の縁（笠石）は壁、縁の内側の床は床）
    K.fit(g, {
      B: '16,16 16,17 28,16 25,27 28,25 33,27 28,36 23,45',
      r: '15,12 15,18 15,19 22,19 22,20 22,22 30,19 30,22 31,22 47,12 47,17 44,15 34,41 34,42 34,43 21,43',
    }, O);
    // 根の戸を調べると一言（閉じている間だけ）
    O.push(K.exam(26, 14, 'elder_root_gate', { cond: '!forest_sw2' }), K.exam(27, 14, 'elder_root_gate', { cond: '!forest_sw2' }));

    const N = [
      K.npc('elm', 'elm', 26, 42, { name: R.T('map.elder_2.N.0.elm.name'), dir: 's', talk: 'elder_elm', cond: 'forest_boss', pushable: false, reward: 'news' }),
    ];

    K.def('elder_2', {
      name: R.T('map.elder_2.name'), kind: 'dungeon', region: 'r_forest', location: 'elder', theme: 'tree_inside',
      legend: {
        B: { mat: 'wall_bark', solid: true, rise: 1 },
        '.': { mat: 'bark_floor' },
        r: { mat: 'root_floor' },
        R: { mat: 'roots', solid: true },
        G: { mat: 'roots', solid: true, name: 'root_gate' },
        '~': { mat: 'water', walk: false },
      },
      rows: g, outside: 'wall_bark',
      // 描いた一枚絵（design/ENV_ASSETS.md §8）。根の戸は closed の絵（閉じている間だけ上に置く）
      art: { image: 'tree_inside/under/elder_2', closed: 'tree_inside/under/elder_2_closed', painted: [] },
      objects: O, npcs: N,
      spawns: {
        top: { x: 23, y: 6, dir: 's' },
        altar: { x: 26, y: 39, dir: 's' },
      },
      exits: [],
      triggers: [
        { id: 'pim_home', x: 22, y: 29, w: 9, h: 4, on: 'step', event: 'elder_pim_home', cond: { guest: 'npc_pim' } },
        { id: 'boss', x: 20, y: 37, w: 13, h: 2, on: 'step', event: 'elder_boss', cond: '!forest_boss' },
      ],
      tilePatches: [
        { cond: 'forest_sw2', rect: [26, 14, 2, 1], rows: ['rr'] },
      ],
      zones: [{ rect: [0, 0, 52, 36], zone: 'z_elder' }],
      light: { ambient: '#5e6e96', k: 0.57, mood: 'tree' },
      dark: false,
      bgm: 'eldertree', bbg: 'tree',
      meta: { chestsInfo: true, floor: R.T('map.elder_2.meta.floor'), sub: R.T('map.elder_2.meta.sub') },
    });
  });
})(window.RPG);
