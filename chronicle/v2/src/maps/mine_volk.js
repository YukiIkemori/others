// CONTENT（ガルド山地）: 鍛冶衆の隠れ村ヴォルク（#16。WORLD_REDESIGN §2.7・§5.14・§4.6、32×28）と、その屋内 4 つ。
//   鉱石の谷の底へ下りた先、滝の横の鍛冶場の集まり。1 枚の下絵（v2/assets/env/mine/under/volk*、field_mine/dng_mine2.py）。当たりは mine_painted_rows.js。
//   入り方（どちらも見える道。A27）:
//     ・鉱石の谷 g_valley の南西の端（沢が谷底へ落ちる所）→ 古い吊り橋（いつでも）→ 村の南の端
//     ・ドヴァンの上の段の西の岩壁の割れ目の古い階段 ⇔ 村の北西の石段（鍛冶衆の下り道。旗 mine_volk_open = 鍛冶衆につく B・仲裁 C で開く）
//   店: 大鍛冶場（ティアで入れ替わる珍しい武器 shop_volk_arms）・宿「滝の音」。
//   住人は鉱山の話の選び方で変わる（ch_mine_side）: 組合 A = 町を去った鍛冶衆（ヘルガ・鍛冶場の売り手）がここへ移る／
//     鍛冶衆 B = ドヴァンの鍛冶衆が行き来する（ピップ）／仲裁 C = 組合の鉱夫が鉱石を売りに来る。選ぶ前は、よそ者を疑う古い鍛冶衆だけ。
//   灯り: 鍛冶場の炉の赤（ember_glow）・家の窓明かり（window_glow）・道の坑夫のカンテラ（hook_lamp）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Mine.kit, L = K.L;
    const P = MK.painted('volk');
    const D = (map, sign) => ({ map, spawn: 'door', sign });
    const O = MK.blds('volk', { volk_inn: D('volk_inn', 'inn'), volk_forge: D('volk_forge', 'weapon'), volk_house: D('volk_house'), volk_elder: D('volk_elder') });
    // 村の入口の看板（吊り橋の上）・鍛冶神の小さな祠・水車・庭の金床
    O.push(K.sign(12, 22, R.T('map.mine_volk.sign')));
    O.push(K.exam(27, 11, 'volk_shrine'), K.exam(28, 11, 'volk_shrine'), K.exam(20, 15, 'volk_wheel'), K.exam(15, 16, 'volk_anvil'));
    // 北西の石段（鍛冶衆の下り道 → ドヴァン）。開くまでは封じの札（石段の口はふさがる = tilePatches）
    O.push(K.exam(6, 3, 'volk_stair', { cond: '!mine_volk_open' }), K.prop('board', 6, 3, { cond: '!mine_volk_open' }));
    O.push({ type: 'door', x: 6, y: 3, look: 'none', to: { map: 'dovan', spawn: 'volkpath' }, cond: 'mine_volk_open', confirm: R.T('map.mine_volk.confirm') });
    // 宝箱（見える所）: 滝つぼのわき・南の岩かげ
    O.push(K.chest('volk_c1', 27, 12, { pool: 'p_T' }), K.chest('volk_c2', 22, 20, { item: 'i_ether', n: 2 }));
    // 灯り: 大鍛冶場の炉の口・家の窓・道の坑夫のカンテラ（岩壁の際）
    O.push(K.prop('ember_glow', 14, 13), K.prop('ember_glow', 18, 13));
    for (const [x, y] of [[4, 11], [9, 11], [4, 21], [7, 21], [24, 20], [27, 20]]) O.push(K.prop('window_glow', x, y));
    for (const [x, y] of [[1, 12], [1, 20], [7, 2], [30, 13], [30, 20], [12, 25]]) O.push(K.prop('hook_lamp', x, y));

    const N = [
      // 吊り橋の番の古い鍛冶（村のことを教える）
      K.npc('bridge_old', 'npc_mine_old_m', 12, 20, { name: R.T('map.mine_volk.N.0.bridge_old.name'), dir: 's', talk: 'volk_bridge_old', reward: 'news' }),
      // 庭の金床で打つ鍛冶衆
      K.npc('yard_smith', 'npc_smith', 14, 15, { name: R.T('map.mine_volk.N.1.yard_smith.name'), dir: 'e', talk: 'volk_yard_smith', reward: 'hint', pushable: false }),
      // 沢のそばの子（トロッコ競走のうわさ・滝の話）
      K.npc('volk_child', 'npc_mine_child', 19, 18, { name: R.T('map.mine_volk.N.2.volk_child.name'), dir: 'w', move: 'wander', talk: 'volk_child', reward: 'hint' }),
      // 選んだあと: B 鍛冶衆 = ピップが石段を下りて来る／C 仲裁 = 組合の鉱夫が鉱石を売りに／A 組合 = 町を去った鍛冶衆の見習い
      K.npc('volk_pip', 'npc_pip', 12, 4, { name: R.T('map.mine_volk.N.3.volk_pip.name'), dir: 's', talk: 'volk_pip', reward: 'news', cond: { choice: 'ch_mine_side', is: 'smiths' } }),
      K.npc('volk_trader', 'npc_miner', 12, 18, { name: R.T('map.mine_volk.N.4.volk_trader.name'), dir: 'n', talk: 'volk_trader', reward: 'news', cond: { choice: 'ch_mine_side', is: 'accord' } }),
      K.npc('volk_apprentice', 'npc_mine_child', 17, 15, { name: R.T('map.mine_volk.N.5.volk_apprentice.name'), dir: 'w', talk: 'volk_apprentice', reward: 'news', cond: { choice: 'ch_mine_side', is: 'guild' } }),
    ];
    const sp = (bid) => MK.doorSpawn('volk', bid);
    K.def('volk', {
      name: R.T('map.mine_volk.volk.name'), kind: 'town', optional: true, region: 'r_mine', location: 'volk', theme: 'mine',
      legend: MK.TOWN({ R: { mat: 'cliff', solid: true, rise: 1 }, T: { mat: 'tree', solid: true }, X: { mat: 'wall_stone', solid: true, name: 'painted' } }),
      rows: P.rows, outside: 'rock', objects: O, npcs: N,
      spawns: {
        bridge: { x: 9, y: 26, dir: 'n' }, stair: { x: 7, y: 3, dir: 'e' }, warp: { x: 15, y: 18, dir: 'n' },
        inn: sp('volk_inn'), forge: sp('volk_forge'), house: sp('volk_house'), elder: sp('volk_elder'),
      },
      exits: [{ x: 9, y: 27, w: 2, h: 1, to: { map: 'g_valley', spawn: 'volk' } }],
      // 石段の口は、開くまでふさがる（描いた石段の上に封じの札）
      tilePatches: [{ cond: '!mine_volk_open', rect: [6, 3, 1, 1], rows: ['X'] }],
      triggers: [{ id: 'arrive', on: 'enter', event: 'volk_arrive' }],
      zones: [],
      light: MK.LIGHT_VILLAGE, dark: false, bgm: 'mine', bbg: 'mine', propSet: 'mine',
      meta: { sub: R.T('map.mine_volk.volk.meta.sub'), chestsInfo: true },
      art: P.art,
    });

    // ================================================================ 屋内
    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      return K.def(id, {
        name, kind: 'interior', region: 'r_mine', location: 'volk',
        legend: MK.ROOM(o.wall || 'wall_stone', o.floor || 'wood_floor'), rows: g, outside: o.wall || 'wall_stone',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: 'volk', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, MK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'mine', propSet: 'mine',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }
    const GUILD = { choice: 'ch_mine_side', is: 'guild' };
    // 宿「滝の音」
    interior('volk_inn', R.T('map.mine_volk.volk_inn'), 14, 11, {
      back: 'inn', carpet: [4, 5, 6, 3], meta: { sub: R.T('map.mine_volk.volk_inn.meta.sub') },
      objects: [K.prop('counter', 2, 3), K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('bed', 9, 2), K.prop('bed', 11, 2), K.prop('bed', 11, 5),
        K.prop('table', 6, 7), K.prop('chair', 5, 7), K.prop('chair', 7, 7), K.prop('fireplace', 7, 1), K.prop('lantern', 1, 7), K.prop('coal_barrel', 12, 8)],
      npcs: [
        K.npc('volk_innkeep', 'npc_mine_woman', 3, 2, { name: R.T('map.mine_volk.volk_inn.npcs.0.volk_innkeep.name'), dir: 's', talk: 'volk_innkeep', pushable: false }),
        K.npc('volk_guest', 'npc_traveler', 10, 7, { name: R.T('map.mine_volk.volk_inn.npcs.1.volk_guest.name'), dir: 'w', talk: 'volk_guest', reward: 'lead' }),
      ],
      spawns: { bed: { x: 10, y: 4, dir: 's' } },
    });
    // 大鍛冶場（武器屋。珍しい武器）。組合につくと、町を去ったヘルガと鍛冶場の売り手もここに
    interior('volk_forge', R.T('map.mine_volk.volk_forge'), 18, 12, {
      back: 'forge', floor: 'stone_floor', meta: { sub: R.T('map.mine_volk.volk_forge.meta.sub') },
      objects: [K.prop('forge', 3, 2), K.prop('forge_glow', 3, 3), K.prop('bellows', 5, 3), K.prop('anvil', 7, 5), K.prop('anvil', 10, 5),
        K.prop('coal_barrel', 1, 5), K.prop('tool_rack', 12, 2), K.prop('weapon_rack', 14, 2), K.prop('weapon_rack', 15, 2),
        K.prop('counter', 13, 7), K.prop('counter', 14, 7), K.prop('counter', 15, 7), K.prop('oath_stone', 16, 4), K.exam(16, 4, 'volk_forge_stone'), K.prop('lantern', 11, 3)],
      npcs: [
        K.npc('volk_master', 'npc_smith', 14, 6, { name: R.T('map.mine_volk.volk_forge.npcs.0.volk_master.name'), title: R.T('map.mine_volk.volk_forge.npcs.0.volk_master.title'), dir: 's', talk: 'volk_master', pushable: false }),
        K.npc('volk_helga', 'npc_helga', 8, 3, { name: R.T('map.mine_volk.volk_forge.npcs.1.volk_helga.name'), title: R.T('map.mine_volk.volk_forge.npcs.1.volk_helga.title'), dir: 's', talk: 'volk_helga', reward: 'news', pushable: false, cond: GUILD }),
        K.npc('volk_dovan_seller', 'npc_smith', 4, 7, { name: R.T('map.mine_volk.volk_forge.npcs.2.volk_dovan_seller.name'), dir: 'e', talk: 'volk_dovan_seller', pushable: false, cond: GUILD }),
      ],
    });
    // 鍛冶の家（家族）・老鍛冶の家（二十年前の話）
    interior('volk_house', R.T('map.mine_volk.volk_house'), 12, 10, {
      back: 'house', meta: { sub: R.T('map.mine_volk.volk_house.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 5, 6), K.prop('chair', 4, 6), K.prop('chair', 6, 6), K.prop('cupboard', 6, 2), K.prop('lantern', 4, 3), K.prop('tool_crate', 10, 7)],
      npcs: [K.npc('volk_wife', 'npc_mine_woman', 5, 4, { name: R.T('map.mine_volk.volk_house.npcs.0.volk_wife.name'), dir: 's', talk: 'volk_wife', reward: 'news' })],
    });
    interior('volk_elder', R.T('map.mine_volk.volk_elder'), 12, 10, {
      back: 'elder', meta: { sub: R.T('map.mine_volk.volk_elder.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('table', 5, 5), K.prop('chair', 4, 5), K.prop('bookshelf', 8, 2), K.prop('fireplace', 6, 1), K.prop('anvil', 9, 6), K.exam(8, 2, 'volk_elder_book')],
      npcs: [K.npc('volk_gunnar', 'npc_mine_old_m', 5, 3, { name: R.T('map.mine_volk.volk_elder.npcs.0.volk_gunnar.name'), dir: 's', talk: 'volk_gunnar', reward: 'lead' })],
    });
  });

  // ---------------------------------------------------------------- よそのマップへのつなぎ（生成したエリア・町のファイルは書き換えない。データの後処理の 2 段目）
  //   鉱石の谷 g_valley の南西の端（沢が谷底へ落ちる所）→ 古い吊り橋 → ヴォルクの南の端（いつでも）
  //   ドヴァンの上の段の西の岩壁の割れ目の古い階段（道具屋の西の路地の北の端）⇔ ヴォルクの北西の石段（mine_volk_open）
  //   ドヴァンのトロッコ乗り場の競走番（トロッコ競走 mine_trolley.js）
  function link() {
    const M = R.DB.maps || {};
    const V = M.g_valley, D = M.dovan;
    if (V && M.volk && !(V.exits || []).some((e) => e.to && e.to.map === 'volk')) {
      V.exits.push({ x: 0, y: 29, w: 1, h: 3, to: { map: 'volk', spawn: 'bridge' } });
      V.spawns.volk = { x: 1, y: 30, dir: 'e' };
      V.objects.push({ type: 'sign', x: 3, y: 28, text: R.T('map.mine_volk.link.text') });
    }
    if (D && M.volk && !(D.objects || []).some((o) => o.to && o.to.map === 'volk')) {
      D.objects.push({ type: 'examine', x: 5, y: 36, event: 'dovan_volkpath', cond: '!mine_volk_open' },
        { type: 'door', x: 5, y: 36, look: 'none', to: { map: 'volk', spawn: 'stair' }, cond: 'mine_volk_open', confirm: R.T('map.mine_volk.link.confirm') });
      D.spawns.volkpath = { x: 5, y: 37, dir: 's' };
      D.npcs.push({ id: 'race_keeper', look: 'npc_miner', name: R.T('map.mine_volk.link.race_keeper.name'), x: 39, y: 25, dir: 's', move: 'still', pushable: false, talk: 'dovan_race_keeper', reward: 'side', key: 'race_keeper' });
    }
  }
  if (R.onData) R.onData(() => R.onData(link));
})(window.RPG);
