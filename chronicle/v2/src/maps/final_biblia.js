// CONTENT（終盤）: 書の都ビブリア（biblia、56×46）。STORY_BIBLE §9.3 の 2・§6.5、WORLD_REDESIGN §5.13。
//   内海のまん中の島の、記録院の白い町。町じゅうが白紙になりかけている（人が名前を忘れていく）。
//   北の区画（低い白い塀の向こう）: 白の大書庫（上のまん中。大扉 → archive_1）・記録院 本院（北西。中に院長の書斎）・大図書館（北東）。
//   まん中: 名もなき語り部の像の噴水の広場・ノアの宿（西）・酒場（東）。南: 白紙堂（店）・家・岸壁と桟橋（記録院の船）。
//   町の絵は 1 枚の下絵（v2/assets/env/finale/under/biblia*）。当たりは絵に合わせた final_painted_rows.js（R.Final.PAINTED.biblia）。
//   建物・戸口は下絵の敷地（blds）。家 3 軒は戸の閉じた家（当たりだけ）。
//   人: 着いたとき（final_sailed・!final_arrived）の桟橋の場面の人／北の門のロウェル（着いた後・封印の前）／白衣の書記（クリアの前）／
//       町の人（白紙になりかけ。ラザロの後・クリアの後で台詞が変わる）。飾りの小物は下絵に描いてある。ここに置くのは働く物（調べる物・宝箱・灯り）だけ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, FK = R.Final.kit, L = K.L;
    const P = FK.painted('biblia');
    const D = (map, sign) => ({ map, spawn: 'door', sign });
    const O = FK.blds('biblia', {
      biblia_archive: { map: 'archive_1', spawn: 'entrance' },
      biblia_records: D('biblia_records'), biblia_library: D('biblia_library'), biblia_inn: D('biblia_inn', 'inn'), biblia_tavern: D('biblia_tavern', 'tavern'),
      biblia_shop: D('biblia_shop', 'item'), biblia_house3: D('biblia_house3'), biblia_house5: D('biblia_house5'),
    });
    // ---------------------------------------------------------------- 働く物
    O.push(K.exam(20, 18, 'biblia_board'), K.exam(21, 18, 'biblia_board'));      // 掲示板（記録院の通達）
    O.push(K.exam(28, 25, 'biblia_statue'), K.exam(28, 20, 'biblia_statue'));    // 名もなき語り部の像
    O.push(K.chest('biblia_c1', 3, 22, { pool: 'p_T' }), K.chest('biblia_c2', 52, 22, { item: 'i_elixir', n: 1 }), K.chest('biblia_c3', 37, 9, { item: 'i_ether2', n: 2 }));
    // 灯り（足もとの置き灯籠。当たりは無い）: 庭と広場の角
    for (const [x, y] of [[20, 22], [36, 22], [3, 17], [52, 17], [24, 36], [31, 36], [22, 12], [34, 12]]) O.push(K.prop('lantern', x, y));
    // 忘却の底への白い階段（広場の南東、描いた下絵。maps/oblivion.js の R.Oblivion.GATE）: クリアの後に「下りますか？」で下りられる。
    //   クリアの前は通せんぼ（gate: 白い霧で下りられない、の一言で 1 歩下がる。出口の印も出さない）
    const OG = R.Oblivion && R.Oblivion.GATE;
    if (OG) for (const [x, y] of OG.stairs) {
      O.push(K.stairs(x, y, { map: 'oblivion_1', spawn: 'from_town' }, Object.assign({
        look: 'none', confirm: R.T('map.final_biblia.oblivion_gate.confirm'),
        gate: { when: '!final_clear', hide: true, text: R.T('map.final_biblia.oblivion_gate.closed') },
      }, x === OG.stairs[0][0] ? { id: 'biblia_oblivion_down' } : {})));
    }

    // ---------------------------------------------------------------- 人
    const pre = '!final_clear';
    const N = [
      // 着いたときの桟橋の場面（biblia_arrival）
      K.npc('white_woman', 'npc_woman_1', 25, 36, { name: R.T('map.final_biblia.N.0.white_woman.name'), dir: 'e', talk: [L(R.T('map.final_biblia.N.talk.0.L'))], reward: null, pushable: false, cond: ['final_sailed', '!final_arrived'] }),
      K.npc('noa_quay', 'noa', 22, 36, { name: R.T('map.final_biblia.N.1.noa_quay.name'), dir: 'e', talk: [L(R.T('map.final_biblia.N.talk.0.L_2'))], reward: null, pushable: false, cond: ['final_sailed', '!final_arrived'] }),
      K.npc('rowell_quay', 'rowell', 28, 37, { name: R.T('map.final_biblia.N.2.rowell_quay.name'), dir: 'n', talk: [L('……。')], reward: null, pushable: false, cond: ['final_sailed', '!final_arrived'] }),
      // 北の門のロウェル（封印の扉を開ける前まで）
      K.npc('rowell', 'rowell', 30, 16, { name: R.T('map.final_biblia.N.3.rowell.name'), dir: 'w', talk: 'biblia_rowell', reward: 'hint', pushable: false, cond: ['final_arrived', '!final_rowell'] }),
      // 記録院の船の船乗り（ファロスへ戻る）
      K.npc('ship_hand', 'npc_sailor_1', 28, 40, { name: R.T('map.final_biblia.N.4.ship_hand.name'), dir: 'n', talk: 'final_ferry_back', reward: null, pushable: false, cond: 'final_arrived' }),
      // 静夜会のイェナ（ファロスから一緒に渡ったとき。名もなき語り部の像の東。クリアの後はビブリアの朝の場面にいる）
      K.npc('b_yena', 'npc_yena', 32, 24, { name: R.T('map.final_biblia.N.b_yena.name'), title: R.T('map.final_biblia.N.b_yena.title'), dir: 'w', talk: 'biblia_yena', reward: null, pushable: false, cond: ['final_yena_ferry', 'final_arrived', '!final_clear', '!final_ending_plaza'] }),
      // 白衣の書記（大書庫の前。本を集めている）
      K.npc('scribe_a', 'npc_scribe', 24, 12, { name: R.T('map.final_biblia.N.5.scribe_a.name'), dir: 's', talk: 'biblia_scribe', reward: 'news', cond: pre }),
      K.npc('scribe_b', 'npc_scribe', 33, 13, { name: R.T('map.final_biblia.N.6.scribe_b.name'), dir: 'w', talk: 'biblia_scribe', reward: 'news', cond: pre }),
      // 町の人（白紙になりかけ）
      K.npc('old_man', 'npc_old_m_1', 23, 23, { name: R.T('map.final_biblia.N.7.old_man.name'), dir: 'e', talk: 'biblia_old_man', reward: 'news' }),
      K.npc('board_woman', 'npc_woman_2', 22, 19, { name: R.T('map.final_biblia.N.8.board_woman.name'), dir: 'n', talk: 'biblia_board_woman', reward: 'news' }),
      K.npc('child', 'npc_child_1', 25, 29, { name: R.T('map.final_biblia.N.9.child.name'), dir: 's', move: 'wander', radius: 2, talk: 'biblia_child', reward: 'news' }),
      K.npc('sailor_old', 'npc_sailor_1', 42, 36, { name: R.T('map.final_biblia.N.10.sailor_old.name'), dir: 'w', talk: 'biblia_sailor', reward: 'news' }),
      K.npc('youth', 'npc_man_1', 11, 29, { name: R.T('map.final_biblia.N.11.youth.name'), dir: 'e', move: { route: [[18, 29], [6, 29], [11, 29]], wait: 2600 }, talk: 'biblia_youth', reward: 'news' }),
      // エンディング（final_ending）: E4 大書庫の入口（まだ夜）・E6 広場（日の出の前）
      K.npc('e_lazaro', 'lazaro', 28, 11, { name: R.T('map.final_biblia.N.12.e_lazaro.name'), dir: 's', talk: [L('……。')], reward: null, pushable: false, cond: 'final_ending_gate' }),
      K.npc('e_rowell', 'rowell', 29, 11, { name: R.T('map.final_biblia.N.13.e_rowell.name'), dir: 'w', talk: [L('……。')], reward: null, pushable: false, cond: 'final_ending_gate' }),
      K.npc('e_noa', 'noa', 27, 26, { name: R.T('map.final_biblia.N.14.e_noa.name'), dir: 's', talk: [L('……。')], reward: null, pushable: false, cond: 'final_ending_plaza' }),
      K.npc('e_mother', 'npc_woman_2', 24, 27, { name: R.T('map.final_biblia.N.15.e_mother.name'), dir: 'e', talk: [L('……。')], reward: null, cond: 'final_ending_plaza' }),
      K.npc('e_boy', 'npc_child_3', 25, 27, { name: R.T('map.final_biblia.N.16.e_boy.name'), dir: 'w', talk: [L('……。')], reward: null, cond: 'final_ending_plaza' }),
      K.npc('cat', 'ani_cat', 46, 28, { name: R.T('map.final_biblia.N.17.cat.name'), dir: 's', move: 'wander', radius: 2, talk: [L(R.T('map.final_biblia.N.talk.0.L_3'))], reward: null }),
    ];

    const sp = (bid) => FK.doorSpawn('biblia', bid);
    K.def('biblia', {
      name: R.T('map.final_biblia.biblia.name'), kind: 'town', region: 'finale', location: 'biblia', theme: 'harbor', propSet: 'star', propSetBase: 'village',
      legend: FK.TOWN(), rows: P.rows, outside: 'wall_marble',
      objects: O, npcs: N,
      spawns: {
        dock: { x: 27, y: 41, dir: 'n' }, warp: { x: 28, y: 32, dir: 's' }, plaza: { x: 27, y: 27, dir: 'n' }, gate: { x: 28, y: 17, dir: 'n' },
        archive: sp('biblia_archive'), records: sp('biblia_records'), library: sp('biblia_library'), inn: sp('biblia_inn'), tavern: sp('biblia_tavern'),
        shop: sp('biblia_shop'), house3: sp('biblia_house3'), house5: sp('biblia_house5'),
        // エンディング: 大書庫の入口（E4）・広場（E6）
        e_gate: { x: 28, y: 13, dir: 'n' }, e_plaza: { x: 28, y: 27, dir: 'n' },
        // 忘却の底から上がって着く所（広場の階段の前）
        oblivion: { x: 32, y: 29, dir: 's' },
      },
      exits: [],
      triggers: [{ id: 'arrival', on: 'enter', event: 'biblia_arrival' }],
      zones: [],
      light: FK.LIGHT_TOWN, dark: false, bgm: 'sorrow', bbg: 'library',
      meta: { sub: R.T('map.final_biblia.biblia.meta.sub'), chestsInfo: true },
      art: P.art,
    });
  });
})(window.RPG);
