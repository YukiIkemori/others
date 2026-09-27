// CONTENT（砂漠）: 砂の鷹団のアジト（WORLD_REDESIGN §2.7 #7、§4.2 の選択と結果、STORY_BIBLE §7.2 の戦の傷）。岩の台地の洞 2 階。
//   desert_hawks_1（44×36）「見張りの洞」: 入口の見張りの広間（泉）→ 細い通路（まだ会っていないと見張りがふさぐ）→
//        西の寝ぐら（盗賊の店）・東の水がめの倉・北の階段。
//   desert_hawks_2（36×28）「頭の広間」: 泉の小部屋 → 頭の広間（ラシード）。
//   野営地 1 の選択 ch_desert_hawk で変わる（どれも同じ品 u_hawk_gloves にたどり着く）:
//     fight → 敵の砦: 鷹団の出現（z_desert_hawks）、頭の広間で頭との再戦 tr_b_hawkhold → 鷹の手袋
//     water → 味方: 団員が迎え、盗賊の店（ふつうの値）、頭が宝の地図・その3 と鷹の手袋をくれる
//     pay   → 中立: 入れるが店は高い（shop_hawks の priceMul 1.5）。手袋は頭から買う
//   年代記に「日継ぎの戦の生き残り」と書いて（ch_desert_write = pain）味方なら、頭の広間に碑が立つ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const L = K.L;
    const LEG = () => ({
      '#': { mat: 'rock', solid: true, rise: 2 },
      '.': { mat: 'dirt' },
      s: { mat: 'sand' },
      k: { mat: 'cracked_clay' },
      c: { mat: 'carpet' },
      w: { mat: 'water', walk: false },
      Q: { mat: 'sandstone_floor' },
    });
    const FIGHT = { choice: 'ch_desert_hawk', is: 'fight' };
    const FRIEND = ['desert_hawk_met', { not: FIGHT }];
    const deco = (O, list) => { for (const [id, x, y, v] of list) O.push(K.prop(id, x, y, v != null ? { variant: v } : undefined)); };

    // ================================================================ 1 階
    {
      const W = 44, H = 36;
      const g = K.grid(W, H, '#');
      K.blob(g, 21, 29, 10, 4, '.', 'hk1a');          // 見張りの広間
      K.rect(g, 20, 33, 3, 3, '.');                     // 入口
      K.rect(g, 21, 15, 1, 12, '.');                     // 細い通路（見張りが立つ）
      K.blob(g, 21, 12, 7, 5, '.', 'hk1b');            // 中の広間
      K.rect(g, 20, 2, 3, 6, '.');                      // 北の階段へ
      K.blob(g, 9, 13, 6, 6, '.', 'hk1c');             // 西の寝ぐら
      K.rect(g, 13, 12, 3, 2, '.');
      K.blob(g, 34, 12, 6, 6, '.', 'hk1d');            // 東の倉
      K.rect(g, 27, 12, 3, 2, '.');
      K.blob(g, 36, 26, 4, 3, '.', 'hk1e'); K.rect(g, 30, 27, 3, 2, '.');   // 東の見張り台（宝箱）
      K.blob(g, 7, 27, 4, 3, '.', 'hk1f'); K.rect(g, 11, 27, 2, 2, '.');   // 西の吹きだまり
      K.blob(g, 21, 30, 5, 2, 's', 'hk1s', '.'); K.blob(g, 9, 14, 3, 2, 'c', 'hk1r', '.'); K.blob(g, 35, 11, 2, 2, 'k', 'hk1k', '.');
      K.rect(g, 38, 9, 2, 2, 'w');                      // 水がめの池（盗んだ水）
      const O = [];
      O.push(K.stairs(21, 3, { map: 'desert_hawks_2', spawn: 'top' }, { id: 'desert_hawks_1_down' }));
      O.push(K.prop('rock_small', 15, 29), K.prop('sack', 16, 30), K.prop('rock_small', 22, 9), K.prop('sack', 23, 10));   // 岩と荷（泉は置かない。WORLD §6.2）
      O.push(K.chest('desert_hawks_1_c1', 38, 25, { pool: 'p_T' }), K.chest('desert_hawks_1_c2', 5, 26, { item: 'i_smoke', n: 2 }),
        K.chest('desert_hawks_1_c3', 36, 16, { pool: 'p_T' }), K.chest('desert_hawks_1_c4', 5, 10, { gold: 180 }), K.chest('desert_hawks_1_c5', 24, 9, { pool: 'p_rare' }));
      O.push(K.exam(33, 9, 'desert_hawks_water'), K.exam(4, 16, 'desert_hawks_bunks'));
      deco(O, [['tent', 7, 11], ['tent', 11, 17], ['firewood', 10, 13], ['sack', 13, 9], ['crate', 4, 13], ['weapon_rack', 6, 9], ['bones', 12, 18],
        ['clay_jars', 31, 8], ['clay_jars', 37, 8], ['cart_barrels', 31, 15], ['crate', 38, 14], ['sack', 33, 17], ['barrel', 39, 12],
        ['broken_pillar', 16, 26], ['bones', 27, 31], ['sand_mound', 24, 32], ['thorn_bush', 18, 33], ['rock_small', 27, 27], ['clay_jars', 17, 11], ['weapon_rack', 24, 10],
        ['bones', 6, 29], ['sand_mound', 38, 28]]);
      for (const [x, y] of [[18, 28], [25, 28], [18, 10], [25, 14], [8, 16], [34, 15], [22, 7], [37, 27], [8, 29]]) O.push(K.prop('torch', x, y));
      O.push(K.sign(23, 33, '――ここより砂の鷹の巣\n名のある者は帰れ'));
      const N = [
        K.npc('sentry', 'npc_hawk', 21, 24, { name: '見張りの男', dir: 's', talk: 'desert_hawks_sentry', pushable: false, reward: 'hint', cond: '!desert_hawk_met' }),
        K.npc('hawk_door', 'npc_hawk', 23, 27, { name: '鷹団の見張り', dir: 'w', talk: 'desert_hawks_member', reward: 'news', cond: FRIEND }),
        K.npc('hawk_shop', 'npc_hawk', 10, 12, { name: '鷹団の闇市', title: '闇市', dir: 's', talk: 'desert_hawks_shop', pushable: false, reward: 'discount', cond: FRIEND }),
        K.npc('hawk_cook', 'npc_desert_woman', 12, 16, { name: '鷹団の炊き手', dir: 'w', talk: 'desert_hawks_member', reward: 'news', cond: FRIEND }),
        K.npc('hawk_old', 'npc_desert_old_m', 34, 13, { name: '年寄りの鷹', dir: 's', talk: 'desert_hawks_old', reward: 'news', cond: FRIEND }),
      ];
      K.def('desert_hawks_1', {
        name: '砂の鷹団のアジト', kind: 'dungeon', optional: true, region: 'r_desert', location: 'hawks', theme: 'cave',
        legend: LEG(), rows: g, outside: 'rock', objects: O, npcs: N,
        spawns: { mouth: { x: 21, y: 33, dir: 'n' }, down: { x: 21, y: 5, dir: 's' } },
        exits: [{ x: 20, y: 35, w: 3, h: 1, to: { map: 'world', spawn: 'hawks' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'desert_hawks_arrive' }],
        zones: [{ rect: null, zone: 'z_desert_hawks', cond: FIGHT }],
        light: DK.LIGHT_TOMB, dark: false, bgm: 'cave', bbg: 'cave',
        meta: { chestsInfo: true, floor: '1 階', sub: '見張りの洞' },
      });
    }

    // ================================================================ 2 階（頭の広間）
    {
      const W = 36, H = 28;
      const g = K.grid(W, H, '#');
      K.rect(g, 16, 22, 4, 5, '.');                    // 上り階段の前
      K.blob(g, 8, 21, 5, 3, '.', 'hk2a'); K.rect(g, 12, 21, 4, 2, '.');   // 泉の小部屋
      K.rect(g, 17, 14, 2, 8, '.');                    // 通路
      K.blob(g, 18, 8, 11, 6, '.', 'hk2b');           // 頭の広間
      K.rect(g, 14, 4, 9, 6, 'c');                     // 敷物
      K.rect(g, 17, 2, 3, 2, 'Q');                     // 頭の座
      K.blob(g, 30, 19, 3, 3, '.', 'hk2c'); K.rect(g, 26, 16, 3, 2, '.'); K.rect(g, 27, 12, 2, 5, '.'); K.rect(g, 24, 12, 4, 2, '.');   // 東の小部屋（宝箱）
      const O = [];
      O.push(K.stairs(17, 25, { map: 'desert_hawks_1', spawn: 'down' }, { id: 'desert_hawks_2_up', look: 'up' }));
      O.push(K.prop('sack', 6, 20), K.prop('rock_small', 7, 21));   // 荷（泉は置かない。WORLD §6.2）
      O.push(K.chest('desert_hawks_2_c1', 31, 21, { pool: 'p_T' }), K.chest('desert_hawks_2_c2', 9, 23, { item: 'i_ether', n: 2 }), K.chest('desert_hawks_2_c3', 26, 6, { pool: 'p_rare' }));
      O.push(K.prop('obelisk', 11, 5, { cond: [FRIEND[0], FRIEND[1], { choice: 'ch_desert_write', is: 'pain' }] }), K.exam(11, 6, 'desert_hawks_memorial', { cond: [FRIEND[0], FRIEND[1], { choice: 'ch_desert_write', is: 'pain' }] }));
      O.push(K.exam(24, 4, 'desert_hawks_map_table'));
      deco(O, [['carpet_rack', 13, 3], ['carpet_rack', 23, 3], ['clay_jars', 10, 8], ['clay_jars', 26, 9], ['weapon_rack', 8, 10], ['weapon_rack', 28, 7],
        ['copper_brazier', 15, 3], ['copper_brazier', 21, 3], ['tomb_urn', 9, 12], ['sack', 31, 18], ['crate', 32, 20], ['bones', 5, 22], ['table', 24, 5]]);
      for (const [x, y] of [[12, 7], [24, 11], [17, 18], [9, 20], [30, 17]]) O.push(K.prop('torch', x, y));
      const N = [
        K.npc('rashid', 'npc_rashid', 18, 4, { name: 'ラシード', title: '砂の鷹団の頭', dir: 's', talk: 'desert_hawks_rashid', pushable: false, reward: 'item',
          cond: { any: [FRIEND, 'desert_hawkhold_done'] } }),
        K.npc('hawk_guard_l', 'npc_hawk', 14, 7, { name: '鷹団の弓手', dir: 'e', talk: 'desert_hawks_member', reward: 'news', cond: FRIEND }),
        K.npc('hawk_guard_r', 'npc_hawk', 22, 7, { name: '鷹団の弓手', dir: 'w', talk: 'desert_hawks_member', reward: 'news', cond: FRIEND }),
      ];
      K.def('desert_hawks_2', {
        name: '砂の鷹団のアジト', kind: 'dungeon', optional: true, region: 'r_desert', location: 'hawks', theme: 'cave',
        legend: LEG(), rows: g, outside: 'rock', objects: O, npcs: N,
        spawns: { top: { x: 17, y: 23, dir: 'n' } },
        exits: [],
        triggers: [{ id: 'boss', x: 9, y: 11, w: 19, h: 1, on: 'step', event: 'desert_hawks_boss', cond: [FIGHT, '!desert_hawkhold_done'] }],
        zones: [{ rect: null, zone: 'z_desert_hawks', cond: [FIGHT, '!desert_hawkhold_done'] }],
        light: DK.LIGHT_TOMB, dark: false, bgm: 'cave', bbg: 'cave',
        meta: { chestsInfo: true, floor: '2 階', sub: '頭の広間' },
      });
    }
  });
})(window.RPG);
