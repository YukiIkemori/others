// CONTENT（ガルド山地）: 鉱山都市ドヴァン（dovan、54×48）。WORLD_REDESIGN §5.10・§4.6、STORY_BIBLE §7.6・§8.7。
//   山の中の大きな洞窟の町。鉱石の谷の門（g_valley）からのトンネルが南の端に出る。三つの段:
//     上の段（南、入口の通り）: 道具屋・宿「坑灯亭」・鍛冶場（鍛冶衆のたまり場、武器屋を兼ねる）・小さな鉱夫の家。
//     中の段（広場）: 酒場「つるはし亭」（組合のたまり場）・鉱夫の家・鉱夫組合の事務所（ボルグ）・トロッコ乗り場（線路の終わり）。
//     下の段（北、いちばん奥）: 集会所（町の寄り合い。選ぶ所）・誓いの碑（文字が半分消えた石）・坑道の入口（深き坑道へ）・地下の水だめ。
//   段の間は岩壁: まん中の広い石段（上 ⇔ 中）・西の長い坂（中 ⇔ 下）・東の線路の切り通し（中 ⇔ 下）と、昇降機の櫓（上 ⇔ 中。固定の行き先）。
//   町の絵は 1 枚の下絵（v2/assets/env/mine/under/dovan*）。当たりは絵に合わせた mine_painted_rows.js（R.Mine.PAINTED.dovan）。
//   建物・戸口は下絵の敷地（blds）。描いた人の役目は絵に合わせた（旗の大きな館 = 集会所、交差したつるはしの館 = 組合、炉の見える家 = 鍛冶場）。
//   灯り: 坑夫のカンテラ（hook_lamp）を岩壁の際（歩けないマス）に。道・戸口の前・出入り口には置かない。飾りの小物は下絵に描いてある。
//   町に入ると、昇降機の前で組合の鉱夫と鍛冶衆がにらみ合っている（選ぶまで）。灯り直したあとは町の灯りが増える（炉の火 forge_glow）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Mine.kit, L = K.L;
    const P = MK.painted('dovan');
    const D = (map, sign) => ({ map, spawn: 'door', sign });
    const O = MK.blds('dovan', {
      dovan_hall: D('dovan_hall'), dovan_guild: D('dovan_guild', 'guild'), dovan_tavern: D('dovan_tavern', 'tavern'), dovan_house: D('dovan_house'),
      dovan_items: D('dovan_items', 'item'), dovan_inn: D('dovan_inn', 'inn'), dovan_forge: D('dovan_forge', 'weapon'), dovan_house2: D('dovan_house2'),
    });
    // ---------------------------------------------------------------- 働く物
    // 坑道の入口（下の段の奥の岩壁。深き坑道 1 階へ。入る前にはい／いいえ）
    O.push({ type: 'door', x: 31, y: 3, look: 'none', to: { map: 'mine_1', spawn: 'entrance' }, confirm: R.T('map.mine_dovan.confirm') });
    // 誓いの碑（下の段の台の上。文字が半分消えている）
    O.push(K.exam(21, 6, 'dovan_oath_stone'), K.exam(22, 6, 'dovan_oath_stone'));
    // 昇降機の櫓（上の段の足もと ⇔ 中の段の上の口）
    O.push(K.exam(44, 35, 'dovan_lift', { stop: 'u' }), K.exam(44, 28, 'dovan_lift', { stop: 'm' }));
    // トロッコ乗り場（線路の終わり。組合につくと、トロッコ線の崖の終点まで走る）
    O.push(K.prop('mine_cart', 41, 26), K.exam(41, 26, 'dovan_cart_station'));
    // 入口の看板（トンネルの出口のわき）
    O.push(K.sign(24, 44, R.T('map.mine_dovan.sign')));
    // 宝箱（見える所だけ）: 下の段の東の隅・中の段の西の隅
    O.push(K.chest('dovan_c1', 48, 10, { pool: 'p_T' }), K.chest('dovan_c2', 5, 27, { item: 'i_potion', n: 2 }));
    // 坑夫のカンテラ（岩壁の際）
    for (const [x, y] of [[18, 13], [36, 13], [24, 17], [46, 17], [4, 18], [23, 31], [29, 31], [15, 34], [41, 34], [4, 43], [49, 43]]) O.push(K.prop('hook_lamp', x, y));
    // 灯り直したあと: 町じゅうの炉と窓に火が入る（光だけの物）
    for (const [x, y] of [[11, 11], [22, 9], [31, 5], [20, 25], [34, 27], [10, 42], [35, 42], [27, 44]]) O.push(K.prop('forge_glow', x, y, { cond: 'cleared_r_mine' }));
    // 選んだ道のあと: 町の広場の張り紙（年代記の（痛）のあと「刃を溶かす日」）
    O.push(K.prop('board', 16, 28, { cond: 'mine_ledger_closed' }), K.exam(16, 28, 'dovan_melt_notice', { cond: 'mine_ledger_closed' }));

    // ---------------------------------------------------------------- 人
    const NO_CHOICE = '!mine_choice';
    const N = [
      // 坑道の入口の見張り（閉じ込められた鉱夫の手がかり）
      K.npc('mouth_watch', 'npc_miner', 33, 4, { name: R.T('map.mine_dovan.N.0.mouth_watch.name'), dir: 'w', talk: 'dovan_mouth_watch', reward: 'lead', pushable: false }),
      // 昇降機の前のにらみ合い（組合の鉱夫と鍛冶衆。選ぶまで）
      K.npc('glare_guild', 'npc_miner', 42, 25, { name: R.T('map.mine_dovan.N.1.glare_guild.name'), dir: 'e', talk: 'dovan_glare_guild', reward: 'news', pushable: false, cond: NO_CHOICE }),
      K.npc('glare_smith', 'npc_smith', 46, 25, { name: R.T('map.mine_dovan.N.2.glare_smith.name'), dir: 'w', talk: 'dovan_glare_smith', reward: 'news', pushable: false, cond: NO_CHOICE }),
      // 選んだあとの広場（A: 組合の祝杯・B: 鍛冶場の火入れ・C: 同じ卓）
      K.npc('toast_guild', 'npc_miner', 28, 26, { name: R.T('map.mine_dovan.N.3.toast_guild.name'), dir: 's', talk: 'dovan_after_guild', reward: 'news', cond: 'mine_choice' }),
      // トロッコ乗り場の古い坑夫（坑夫のカンテラの油売りの話・宝石ハリネズミのうわさ）
      K.npc('station_old', 'npc_mine_old_m', 38, 28, { name: R.T('map.mine_dovan.N.4.station_old.name'), dir: 'e', talk: 'dovan_station_old', reward: 'boss' }),
      // タデオ（灯守組合の油売り。坑夫のカンテラの依頼）
      K.npc('tadeo', 'npc_tadeo', 22, 44, { name: R.T('map.mine_dovan.N.5.tadeo.name'), title: R.T('map.mine_dovan.N.5.tadeo.title'), dir: 'n', talk: 'dovan_tadeo', reward: 'side' }),
      // 広場の子（落盤の子猫）
      K.npc('cat_kid', 'npc_mine_child', 19, 27, { name: R.T('map.mine_dovan.N.6.cat_kid.name'), dir: 's', talk: 'dovan_cat_kid', reward: 'side' }),
      // 上の段の通りの女・下の段の年寄り
      K.npc('street_woman', 'npc_mine_woman', 13, 43, { name: R.T('map.mine_dovan.N.7.street_woman.name'), dir: 'n', move: 'wander', talk: 'dovan_street_woman', reward: 'hint' }),
      K.npc('hall_old', 'npc_mine_old_f', 14, 12, { name: R.T('map.mine_dovan.N.8.hall_old.name'), dir: 's', talk: 'dovan_hall_old', reward: 'news' }),
      // 子猫（助けたあと、子のそばに）
      K.npc('kitten', 'ani_cat', 20, 28, { name: R.T('map.mine_dovan.N.9.kitten.name'), dir: 'w', move: 'wander', talk: [L(R.T('map.mine_dovan.N.talk.0.L'))], reward: null, cond: 'mine_kitten_home' }),
      // 灯り直す場面（炉の前の広場に町の人が集まる。場面の間だけ）
      K.npc('relight_borg', 'npc_borg', 21, 9, { name: R.T('map.mine_dovan.N.10.relight_borg.name'), dir: 'n', talk: [L('……。')], reward: null, pushable: false, cond: 'mine_relight_scene' }),
      K.npc('relight_helga', 'npc_helga', 23, 9, { name: R.T('map.mine_dovan.N.11.relight_helga.name'), dir: 'n', talk: [L('……。')], reward: null, pushable: false, cond: 'mine_relight_scene' }),
      K.npc('relight_pip', 'npc_pip', 25, 9, { name: R.T('map.mine_dovan.N.12.relight_pip.name'), dir: 'n', talk: [L('……。')], reward: null, pushable: false, cond: 'mine_relight_scene' }),
    ];

    const sp = (bid) => MK.doorSpawn('dovan', bid);
    K.def('dovan', {
      name: R.T('map.mine_dovan.dovan.name'), kind: 'town', region: 'r_mine', location: 'dovan', theme: 'mine',
      legend: MK.TOWN(), rows: P.rows, outside: 'wall_cave',
      objects: O, npcs: N,
      spawns: {
        gate: { x: 26, y: 46, dir: 'n' }, warp: { x: 27, y: 27, dir: 's' }, mine: { x: 31, y: 4, dir: 's' }, oath: { x: 22, y: 8, dir: 'n' },
        lift_u: { x: 44, y: 36, dir: 's' }, lift_m: { x: 44, y: 27, dir: 'n' }, station: { x: 39, y: 27, dir: 'w' },
        hall: sp('dovan_hall'), guild: sp('dovan_guild'), tavern: sp('dovan_tavern'), house: sp('dovan_house'), items: sp('dovan_items'),
        inn: sp('dovan_inn'), forge: sp('dovan_forge'), house2: sp('dovan_house2'),
      },
      exits: [{ x: 26, y: 47, w: 2, h: 1, to: { map: 'g_valley', spawn: 'gate' } }],
      triggers: [{ id: 'arrival', on: 'enter', event: 'dovan_arrival' }],
      zones: [],
      light: MK.LIGHT_TOWN, dark: false, bgm: 'town', bbg: 'mine', propSet: 'mine',
      meta: { sub: R.T('map.mine_dovan.dovan.meta.sub'), chestsInfo: false },
      art: P.art,
    });
  });
})(window.RPG);
