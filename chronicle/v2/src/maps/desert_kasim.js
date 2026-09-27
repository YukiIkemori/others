// CONTENT（砂漠）: オアシスの町カシム（kasim）。WORLD_REDESIGN §5.5・§4.2、STORY_BIBLE §7.2・§8.3。
//   町 62×56、角の丸い日干しれんがの外壁。門は西（王墓へ＝隊商路）と東（灰の荒野へ）。
//   まん中に古い泉（枯れかけ。解決で水が戻る＝tilePatches）→ 泉を囲む石畳の広場（日時計・掲示板・ナディアの踊り）→
//   天幕の屋台が迷路のように並ぶ市場の輪（武具の屋台・市場の屋台＝値切り・なつめやしの屋台）→ 外周の家々:
//   北: 宿「泉の星亭」（8×6）・酒場「砂時計」・王墓の番アブルの家
//   西: 道具屋・地図屋・占いの天幕     東: 隊商ギルド（8×6）・井戸掘りの親方の家・戦没者の碑
//   灯りの形は「泉を囲む油の灯」（銅のかがり火と吊り灯籠、WORLD §5.1）。町に隠し通路は置かない（A27）。宝箱は見える物 2 つ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const W = 62, H = 56, CX = 31, CY = 27;
    const g = K.grid(W, H, 'u');
    const inT = (x, y, rx, ry) => DK.superellipse(x + 0.5, y + 0.5, CX + 0.5, CY + 0.5, rx, ry, 4);
    const ell = (x, y, rx, ry) => ((x - CX) / rx) ** 2 + ((y - CY) / ry) ** 2;

    // ---------------------------------------------------------------- 地面と外壁
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (inT(x, y, 27.5, 24.5)) g[y][x] = 's';
      else if (inT(x, y, 29.5, 26.5)) g[y][x] = 'X';
    }
    // 門（西・東）と大通り
    K.rect(g, 0, 26, 5, 3, 'Q'); K.rect(g, 57, 26, 5, 3, 'Q');
    K.rect(g, 3, 26, 56, 3, 'Q');
    // 南北の小道
    K.rect(g, 30, 4, 2, 48, 'k', ['s']);
    // 泉のまわりの広場（石畳）と、枯れかけた泉の水盤
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = ell(x, y, 11.5, 9.5);
      if (e < 1) g[y][x] = 'Q';
      const b = ell(x, y, 6, 5);
      if (b < 1) g[y][x] = b > 0.62 ? 'x' : 'k';
    }
    // 水盤の段（南と北の降り口）
    K.rect(g, 30, 31, 2, 2, 'Q'); K.rect(g, 30, 22, 2, 2, 'Q');
    K.rect(g, 30, 26, 2, 2, 'w');                                   // 底に残った水たまり
    // 市場の輪: 屋台の列のあいだの路地（粘土）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = ell(x, y, 17, 14);
      if (e < 1 && ell(x, y, 11.5, 9.5) >= 1 && g[y][x] === 's') g[y][x] = (x + y) % 7 === 0 ? 'k' : 's';
    }
    // 外周の道（家々の前）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = ell(x, y, 19, 16); if (e >= 1 && e < 1.18 && g[y][x] === 's') g[y][x] = 'k'; }

    // ---------------------------------------------------------------- 建物
    const O = [];
    const B = (id, kind, x, y, to, o) => { const b = DK.bld(id, kind, x, y, Object.assign({ to }, o || {})); O.push(b.obj); return b.door; };
    const dInn = B('kasim_b_inn', 'l', 22, 3, { map: 'kasim_inn', spawn: 'door' }, { sign: 'inn' });
    const dTav = B('kasim_b_tavern', 'm', 34, 3, { map: 'kasim_tavern', spawn: 'door' }, { sign: 'tavern' });
    const dAbul = B('kasim_b_abul', 's', 43, 6, { map: 'kasim_abul', spawn: 'door' });
    const dShop = B('kasim_b_shop', 'm', 7, 13, { map: 'kasim_shop', spawn: 'door' }, { sign: 'item' });
    const dMap = B('kasim_b_mapshop', 's', 5, 34, { map: 'kasim_mapshop', spawn: 'door' }, { sign: 'map' });
    const dFort = B('kasim_b_fortune', 's', 11, 41, { map: 'kasim_fortune', spawn: 'door' });
    const dGuild = B('kasim_b_guild', 'l', 40, 41, { map: 'kasim_guild', spawn: 'door' }, { sign: 'guild' });
    const dDig = B('kasim_b_digger', 's', 51, 34, { map: 'kasim_digger', spawn: 'door' });
    B('kasim_b_h1', 's', 13, 5, null, {});
    B('kasim_b_h2', 's', 49, 15, null, {});
    B('kasim_b_h3', 'm', 22, 45, null, {});
    B('kasim_b_h4', 's', 31, 47, null, {});
    B('kasim_b_h5', 's', 4, 19, null, {});

    // ---------------------------------------------------------------- 広場: 泉・日時計・掲示板・かがり火
    O.push(K.prop('obelisk', 31, 35), K.exam(31, 36, 'kasim_sundial'));                     // 砂に埋もれた日時計（lo_time_desert）
    O.push(K.prop('board', 38, 33), K.exam(38, 34, 'kasim_board'));                          // 隊商ギルドの掲示板（広場の南東）
    O.push(K.exam(30, 24, 'kasim_spring_letters'));                                          // 泉の底の古い文字
    O.push(K.prop('broken_pillar', 42, 23), K.exam(42, 24, 'kasim_memorial'));             // 戦没者の碑（名が削れている）
    for (const [x, y] of [[23, 21], [39, 21], [21, 27], [41, 29], [23, 33], [39, 33], [27, 18], [35, 18], [27, 36], [35, 36]]) O.push(K.prop('copper_brazier', x, y));
    for (const [x, y] of [[4, 25], [4, 29], [57, 25], [57, 29], [29, 4], [32, 4], [29, 51], [32, 51]]) O.push(K.prop('copper_brazier', x, y));
    for (const [x, y] of [[24, 24], [38, 24], [24, 31], [38, 31]]) O.push(K.prop('desert_palm', x, y, { variant: (x + y) % 2 }));
    // 解決のあと: 泉に水が戻り、まわりに花と草（tilePatches は下）
    for (const [x, y] of [[26, 22], [36, 22], [26, 32], [36, 32]]) O.push(K.prop('flower_pot', x, y, { cond: 'cleared_r_desert' }));

    // ---------------------------------------------------------------- 市場の輪（屋台・天幕・壺の山）
    const STALLS = [
      [19, 18], [22, 16], [25, 14], [37, 14], [40, 16], [43, 18], [16, 22], [16, 32], [46, 22], [46, 32],
      [19, 36], [22, 38], [25, 40], [37, 40], [40, 38], [43, 36], [14, 27], [48, 26],
    ];
    STALLS.forEach(([x, y], i) => O.push(K.prop(i % 3 === 0 ? 'desert_stall' : i % 3 === 1 ? 'carpet_rack' : 'stall', x, y)));
    // 屋台の列（輪の形。ところどころ切れて路地になる＝迷路のような市場）
    {
      const taken = new Set(STALLS.map(([x, y]) => x + ',' + y));
      const rng = R.rng('kasim_stalls');
      for (let a = 0; a < 360; a += 7) {
        const t = (a * Math.PI) / 180, x = Math.round(CX + Math.cos(t) * 15.2), y = Math.round(CY + Math.sin(t) * 12.6);
        if (Math.abs(y - CY - 0.5) <= 2.5 || Math.abs(x - CX - 0.5) <= 2) continue;   // 大通りと南北の小道は空ける
        if (rng.next() < 0.3 || taken.has(x + ',' + y) || K.at(g, x, y) !== 's') continue;
        taken.add(x + ',' + y);
        O.push(K.prop(['desert_stall', 'carpet_rack', 'clay_jars', 'stall', 'crate'][rng.int(0, 4)], x, y));
      }
    }
    for (const [x, y] of [[20, 18], [23, 16], [26, 14], [36, 14], [39, 16], [42, 18], [17, 23], [17, 31], [45, 23], [45, 31], [20, 36], [23, 38], [36, 40], [39, 38], [42, 36]]) O.push(K.prop(((x * 3 + y) % 3) ? 'clay_jars' : 'crate', x, y));
    for (const [x, y] of [[13, 23], [13, 31], [49, 23], [49, 31], [28, 12], [34, 12], [28, 42], [34, 42]]) O.push(K.prop('tent', x, y));
    // 町の宝箱 2（見える所だけ）
    O.push(K.chest('kasim_c1', 50, 11, { pool: 'p_T' }), K.chest('kasim_c2', 9, 46, { item: 'i_ether', n: 2 }));
    // 門の看板と、外周の小物
    O.push(K.sign(6, 24, 'オアシスの町カシム\n西の門 → 隊商路・王墓'), K.sign(55, 24, '東の門 → 灰の荒野'));
    O.push(K.prop('cart_barrels', 52, 24), K.prop('cart_barrels', 9, 30), K.prop('clay_jars', 21, 8), K.prop('clay_jars', 42, 11), K.prop('tomb_urn', 47, 9));
    O.push(K.prop('sack', 32, 8), K.prop('barrel', 33, 9), K.prop('cactus', 12, 10), K.prop('cactus', 51, 44), K.prop('clay_jars', 18, 49), K.prop('desert_palm', 10, 38, { variant: 1 }));
    O.push(K.prop('desert_palm', 53, 30), K.prop('desert_palm', 18, 12), K.prop('desert_palm', 45, 48, { variant: 1 }), K.prop('dry_well', 47, 29), K.exam(47, 30, 'kasim_well'));
    O.push(K.prop('lantern', 27, 9), K.prop('lantern', 37, 9), K.prop('lantern', 14, 17), K.prop('lantern', 49, 20), K.prop('lantern', 13, 38), K.prop('lantern', 46, 40));

    // ---------------------------------------------------------------- 人（話す見返り: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況）
    const L = K.L;
    const N = [
      // 広場
      K.npc('fara', 'npc_fara', 31, 25, { name: 'ファラ', title: '泉の番人の娘', dir: 's', talk: 'kasim_fara', reward: 'lead', cond: '!cleared_r_desert' }),
      K.npc('fara_after', 'npc_fara', 33, 33, { name: 'ファラ', title: '泉の番人の娘', dir: 'n', talk: 'kasim_fara', reward: 'lead', cond: 'cleared_r_desert' }),
      K.npc('nadia', 'npc_nadia', 27, 33, { name: 'ナディア', title: '踊り子', dir: 's', talk: 'kasim_nadia', reward: 'lead' }),
      K.npc('zaid_plaza', 'npc_zaid', 36, 34, { name: 'ザイード', title: '隊商の長', dir: 's', talk: 'kasim_zaid', reward: 'lead', cond: ['!desert_caravan_on', '!desert_camp3_done'] }),
      K.npc('zaid_after', 'npc_zaid', 36, 34, { name: 'ザイード', title: '隊商の長', dir: 's', talk: 'kasim_zaid', reward: 'discount', cond: 'cleared_r_desert' }),
      K.npc('child_dates', 'npc_desert_child', 20, 30, { name: '市場の子', dir: 'e', talk: 'kasim_child', reward: 'side', move: 'still' }),
      K.npc('sundial_old', 'npc_desert_old_m', 29, 37, { name: '日時計のじいさま', dir: 'e', talk: 'kasim_old_man', reward: 'news' }),
      // 市場
      K.npc('arms_vendor', 'npc_desert_man', 21, 17, { name: '武具売りのハミド', title: '市場の武具の屋台', dir: 's', talk: 'kasim_arms', pushable: false, reward: null }),
      K.npc('bazaar', 'npc_desert_woman', 41, 17, { name: '屋台のサルマ', title: '市場の屋台', dir: 's', talk: 'kasim_bazaar', pushable: false, reward: 'discount' }),
      K.npc('dates_vendor', 'npc_desert_old_f', 17, 33, { name: 'なつめやし売り', dir: 'e', talk: 'kasim_dates', reward: 'side' }),
      K.npc('salt_vendor', 'npc_caravan', 44, 33, { name: '塩売りのカリム', dir: 'w', talk: 'kasim_salt', reward: 'side' }),
      K.npc('tadeo', 'npc_tadeo', 44, 22, { name: 'タデオ', title: '灯守組合の油売り', dir: 's', talk: 'kasim_tadeo', reward: 'side' }),
      K.npc('guard_w', 'npc_desert_man', 5, 25, { name: '西の門番', dir: 'e', talk: 'kasim_gate_w', reward: 'boss' }),
      K.npc('guard_e', 'npc_desert_man', 56, 25, { name: '東の門番', dir: 'w', talk: 'kasim_gate_e', reward: 'news' }),
      K.npc('woman_mid', 'npc_desert_woman', 24, 26, { name: '水売りの女', dir: 'e', talk: 'kasim_water_woman', reward: 'item' }),
      K.npc('hawk_friend', 'npc_desert_man', 15, 26, { name: '日焼けした男', dir: 'e', talk: 'kasim_hawk_friend', reward: 'hint' }),
      K.npc('rashid_memorial', 'npc_rashid', 43, 25, { name: 'ラシード', title: '砂の鷹団の頭', dir: 'n', talk: 'kasim_rashid_memorial', reward: 'news', cond: ['cleared_r_desert', { choice: 'ch_desert_write', is: 'pain' }] }),
      K.npc('yura_returnee', 'npc_yura_woman', 34, 30, { name: 'ライラ', title: '藍染め職人', dir: 's', talk: 'kasim_yura_dyer', reward: 'side' }),
      K.npc('pilgrim_kid', 'npc_desert_child', 38, 28, { name: '泉で遊ぶ子', dir: 'w', move: 'wander', talk: 'kasim_kid', reward: 'hint' }),
      // 空気だけ（4 人まで）
      K.npc('camel_1', 'ani_camel', 51, 27, { name: 'ラクダ', dir: 'w', talk: [L('ラクダは、つまらなそうに\n砂をかんでいる。')], reward: null }),
      K.npc('cat', 'ani_cat', 26, 39, { name: '猫', dir: 's', move: 'wander', talk: [L('ニャア。')], reward: null }),
      K.npc('woman_air', 'npc_desert_woman', 11, 26, { name: '市場の女', dir: 'e', talk: [L('泉が枯れてから、\n水は油と同じ値段さ。\n……油の値も上がってるけどね。'), L('cleared_r_desert', '水の値が、半分になったよ！\n今夜はお茶を三杯飲むんだ。')], reward: null }),
    ];
    // 人の前後左右には物を置かない
    const near = new Set();
    for (const n of N) for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) near.add((n.x + dx) + ',' + (n.y + dy));
    for (let i = O.length - 1; i >= 0; i--) { const o = O[i]; if (o.type === 'prop' && near.has(o.x + ',' + o.y)) O.splice(i, 1); }
    // 飾りを散らす（道・戸口・広場の真ん中は空ける）
    const keep = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ('Qk'.includes(K.at(g, x, y))) keep.add(x + ',' + y);
    for (const o of O) if (o.type === 'building' && o.door) for (let dy = 0; dy <= 2; dy++) keep.add(o.door.x + ',' + (o.door.y + dy));
    for (const k of near) keep.add(k);
    K.scatter(g, O, ['clay_jars', 'sand_mound', 'tomb_urn', 'cactus'], 18, [3, 3, 56, 50], 's', 'kasim_deco', { keep, gap: 4 });
    K.scatter(g, O, ['desert_palm'], 8, [3, 3, 56, 50], 's', 'kasim_palm', { keep, gap: 6, variant: true });

    K.def('kasim', {
      name: 'オアシスの町カシム', kind: 'town', region: 'r_desert', location: 'kasim', theme: 'desert_town',
      legend: DK.LEGEND(),
      rows: g, outside: 'dune_sand',
      objects: O, npcs: N,
      spawns: {
        gate_w: { x: 3, y: 27, dir: 'e' },
        gate_e: { x: 58, y: 27, dir: 'w' },
        plaza: { x: 31, y: 34, dir: 'n' },
        inn: { x: dInn.x, y: dInn.y + 1, dir: 's' },
        tavern: { x: dTav.x, y: dTav.y + 1, dir: 's' },
        abul: { x: dAbul.x, y: dAbul.y + 1, dir: 's' },
        shop: { x: dShop.x, y: dShop.y + 1, dir: 's' },
        mapshop: { x: dMap.x, y: dMap.y + 1, dir: 's' },
        fortune: { x: dFort.x, y: dFort.y + 1, dir: 's' },
        guild: { x: dGuild.x, y: dGuild.y + 1, dir: 's' },
        digger: { x: dDig.x, y: dDig.y + 1, dir: 's' },
        spring: { x: 31, y: 30, dir: 'n' },
        warp: { x: 31, y: 38, dir: 'n' },
      },
      exits: [
        { x: 0, y: 26, w: 1, h: 3, to: { map: 'world', spawn: 'kasim' } },
        { x: 61, y: 26, w: 1, h: 3, to: { map: 'world', spawn: 'kasim_e' } },
      ],
      triggers: [{ id: 'arrival', on: 'enter', event: 'kasim_arrival' }],
      tilePatches: [
        // 解決のあと: 泉に水が戻る（水盤の底が水に）
        { cond: 'cleared_r_desert', rect: [26, 23, 12, 9], rows: (() => {
          const rows = [];
          for (let y = 23; y < 32; y++) { let r = ''; for (let x = 26; x < 38; x++) { const b = ell(x, y, 6, 5); r += b < 0.62 ? 'w' : ' '; } rows.push(r); }
          return rows;
        })() },
      ],
      zones: [],
      light: DK.LIGHT_TOWN,
      dark: false,
      bgm: 'kasim',
      meta: { sub: '泉を囲む市場の町', chestsInfo: false },
    });
  });
})(window.RPG);
