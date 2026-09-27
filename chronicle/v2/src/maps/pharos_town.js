// CONTENT-P: 港町ファロス（pharos、町 64×48）。V2_PLAN §3.2・§3.3 P4〜P7・P10、WORLD_REDESIGN §5.3、STORY_BIBLE §8.1・§9.1
//   崖にしがみつく港町。四角い家の並ぶ町ではなく、崖と海の岩柱に住む町。道は段から段へ曲がりくねり、石段と吊り橋で上り下りする:
//   上の段（西、y 9〜13）   : 門（西、ワールドへ）の踊り場。岩壁を掘った宿と家。石段で岩の背を越えて、
//   高い棚（y 6〜8）        : 崖を掘った家と、古い見張りの塔（記録院の出張所）。東の石段で下りると、
//   東の段（y 11〜13）      : 北の岩柱へ吊り橋。
//   崖に斜めに乗り上げた古いガレオン船: 船尾 = 潮風亭（西の段へ戸）・船の腹 = 武具屋（中の棚へ戸）・船首 = 道具屋（船首の台へ戸）。
//   中の棚（y 16〜26）      : 西の段から曲がって下りる小道の先に、網を干す丸い石畳の広場（井戸・夜市・掲示板）。ひっくり返した小舟の家。
//   下の段（y 29〜32）      : 崖の根もとの板の遊歩道。崖の面を掘った家、杭の上の造船所の帆布小屋、曲がった桟橋の先の小舟の家、
//                             長さのちがう桟橋（西は折れ曲がり、中は定期船の T 字）。
//   東の海の岩柱 2 つ       : 北の岩柱（掘った家・見張りの老水夫）と東の岩柱（静夜会のイェナ）。吊り橋で東の段・船首の台・岩柱どうしをつなぐ。
//   南東の沖に灯台の岩。灯りの形 = 灯台（序章の後、岬の灯が町を掃く）・船の灯・崖の窓明かり。宝箱 2。出現なし。
//   spawns: gate_w（西の門、ワールドから）・warp（広場）・inn_front（P10 の朝の場面）・harbor・<建物>_door（屋内から戻る所）
//   町の絵は 1 枚の下絵（v2/assets/env/harbor/under/pharos*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;

    // ---------------------------------------------------------------- 地面（1 文字 = 1 マス。G 崖の上の草・# 岩と崖・. 岩棚の敷石・g 草・c 石畳・e 石段・p 板・b 吊り橋・~ 海）
    const g = [
      'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG~~~~~~~~~~~~~~~~~~~~',
      'GGGGGGGG##GG###GGGGGGGG###GG##GGGGGGGGG###GG~~~~~~~~~~~~~~~~~~~~',
      'GGG#GGG#########GG##GGG########GGG##GG#####~~~~~######~~~~~~~~~~',
      '###########################################~~~##########~~~~~~~~',
      '############################################~###########~~~~~~~~',
      '###########################################~~############~~~~~~~',
      '#######################..################~~~#############~~~~~~~',
      '################.................#######~~~~#############~~~~~~~',
      '################..................#######~~~#############~~~~~~~',
      '###........######ee#############ee#######~~~##.........#~~~~~~~~',
      '.............####ee#############ee######~~~~~#..........~~~~~~~~',
      '...................##########..........###~~~#..........~~~~~~~~',
      '##..gg.......g.....##########............bbbbb.........~~~~~~~~~',
      '####gg....####################..........#bbbbb~.......~~~~~~~~~~',
      '#####ee####################################~~~~~~~~ee~~~~~~~~~~~',
      '#####ee#####################################~~~~~~~ee~~~~~~~~~~~',
      '#####...........############################~~~~~~~bb~~~~~~~~~~~',
      '#####......................###############~~~~~~~~~bb~~~~~~~~~~~',
      '############..............###############~~~~~~~~~~bb~~####~~~~~',
      '###############ee########################~~~~~~~~~~..........#~~',
      '#############...................#########~~~~~~~~~~...........#~',
      '####.........ccccccc............########~~~~~~~~~~#...........#~',
      '#####.......ccccccccc.....###...###########~~~~~~~#...........#~',
      '####.......ccccccccccc.....##...###########~~~~~~~#...........#~',
      '####........ccccccccc......##.............bbbbbbbbb..........##~',
      '#####........cccccc.......####............bbbbbbbbb~........###~',
      '##########..............#########........##~~~~~~~~~~##ee#####~~',
      '##########ee##########ee##############ee###~~~~~~~~~~~~ee###~~~~',
      '##########ee##########ee##############ee###~~~~~~~~~~~~pp~~~~~~~',
      '###ppppppppppppppppppppppppppppppppppppppppp~~~~~~~~~~~pp~~~~~~~',
      '###ppppppppppppppppppppppppppppppppppppppppppppppppppppppppp~~~~',
      '~~~ppppppppppppppppppppppppppppppppppppppppppppppppppppppppp~~~~',
      '~~~ppppppppppppp~~~~~~pppppppppppppppppppppppppppppppppppppp~~~~',
      '~~~pppppppp~~~~~~~~~~~ppp~~~pppppppppppp~~~~~~pp~~~~~~~~~~~~~~~~',
      '~~~~~~~~~pp~~~~~~~~~~~ppp~~~ppppp~pp~~~~~~~~~~pp~~~~~~~~~~~~~~~~',
      '~~~~~~~~~pp~~~~~~~~~~~ppp~~~ppppp~pp~~~~~~~~~~pp~~~~~~~~~~~~~~~~',
      '~~~~~~~~~pp~~~~~~~~~~~ppp~~~~ppppppp~~~~~~~~~~pp~~~~~~~~~~~~~~~~',
      '~~~~~~~~~ppppp~~~~~~~~ppp~~~~ppppppp~~~~~~~~~~pp~~~~~~~~~####~~~',
      '~~~~~~~~~ppppp~~~~~~~~ppp~~~~~~~~~~~~~~~~~~~~~pppp~~~~~~~#####~~',
      '~~~~~~~~~~~~pp~~~~~~~~ppp~~~~~~~~~~~~~~~~~~~~~pppp~~~~~~######~~',
      '~~~~~~~~~~~~pp~~~~~~~~ppp~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#######~',
      '~~~~~~~~~~~~pp~~~~~ppppppppp~~~~~~~~~~~~~~~~~~~~~~~~~~~~#######~',
      '~~~~~~~~~~~~pp~~~~~ppppppppp~~~~~~~~~~~~~~~~~~~~~~~~~~~~#######~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#######~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~######~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~####~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ].map((r) => [...r]);

    const legend = {
      '.': { mat: 'stone_floor' }, c: { mat: 'cobble' }, g: { mat: 'grass' }, G: { mat: 'grass', solid: true },
      '#': { mat: 'rock', solid: true, rise: 1 }, e: { mat: 'stone_floor', name: 'stairs' },
      p: { mat: 'pier' }, b: { mat: 'bridge' }, '~': { mat: 'sea', walk: false },
    };

    // ---------------------------------------------------------------- 建物（戸口は描いた扉のマス。出て着くのはその真下）
    const b = K.b, P = K.prop, PS = K.props;
    const door = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });
    const cave = { roof: 'slate', mat: 'stone', wall: 3 };   // 岩を掘った住まい（絵が無いときの控えの見た目）
    const hull = { roof: 'shingle', mat: 'plank', wall: 2 };  // 船の胴
    const buildings = [
      // 岩壁を掘った住まい（高さも向きもばらばら）
      b('ph_inn', 3, 4, 8, 5, Object.assign({}, cave, { windows: 3, sign: 'inn', lamp: true, door: door(6, 8, 'pharos_inn') })),
      b('ph_house2', 11, 6, 5, 5, Object.assign({}, cave, { windows: 1, door: door(13, 10, 'pharos_home2') })),   // 家の中は homes_slice.js
      b('ph_house1', 19, 2, 5, 5, Object.assign({}, cave, { windows: 2, door: door(21, 6, 'pharos_home1') })),
      b('ph_record', 25, 2, 6, 6, { roof: 'slate', mat: 'stone', wall: 3, windows: 2, sign: 'record', lamp: true, door: door(28, 7, 'pharos_record') }),   // 古い見張りの塔
      b('ph_house3', 47, 4, 6, 5, Object.assign({}, cave, { windows: 2, door: door(49, 8, 'pharos_home3') })),
      b('ph_house5', 12, 25, 6, 4, Object.assign({}, cave, { wall: 2, windows: 2, door: door(15, 28, 'pharos_home5') })),
      // 崖に乗り上げたガレオン船（3 つの店。船尾・腹・船首で段がちがう）
      b('ph_tavern', 19, 12, 10, 5, Object.assign({}, hull, { windows: 3, sign: 'tavern', lamp: true, door: door(24, 16, 'pharos_tavern') })),
      b('ph_smith', 27, 15, 7, 5, Object.assign({}, hull, { windows: 2, sign: 'weapon', lamp: true, door: door(30, 19, 'pharos_smith') })),
      b('ph_shop', 32, 19, 5, 5, Object.assign({}, hull, { windows: 1, sign: 'item', lamp: true, door: door(34, 23, 'pharos_shop') })),
      // ひっくり返した小舟の家（中の棚）と、杭の上の小舟の家（曲がった桟橋の先）
      b('ph_house4', 4, 20, 5, 4, Object.assign({}, hull, { windows: 1, door: door(6, 23, 'pharos_home4') })),
      b('ph_house6', 28, 32, 5, 4, Object.assign({}, hull, { windows: 1, door: door(30, 35, 'pharos_home6') })),
      // 杭の上の造船所（帆布の三角小屋）
      b('ph_shipyard', 42, 26, 6, 5, { wall: 2, roof: 'shingle', mat: 'plank', windows: 1, sign: 'guild', lamp: true, door: door(44, 30, 'pharos_shipyard') }),
    ];
    // 戸口のマスは歩ける床（崖を掘った戸の足もと）
    for (const o of buildings) if (g[o.door.y][o.door.x] === '#') g[o.door.y][o.door.x] = '.';

    const objects = buildings.concat([
      // ---------------------------------------------------------------- 門の踊り場と高い棚
      // 街灯は壁・崖の際。戸口の真下・門・石段の口には立てない（v2/tools/qa/check_lamps.js）
      ...PS('lamp_post', [[9, 13], [3, 10], [17, 7], [24, 6], [31, 11], [34, 13], [13, 16], [13, 20], [24, 20], [10, 24], [22, 24], [29, 24], [47, 9], [51, 20], [60, 24]]),
      ...PS('flower_pot', [[4, 9], [8, 9], [20, 7], [31, 8]]), P('barrel', 10, 9), P('sack', 11, 12), P('crate', 16, 12),
      P('rock_small', 8, 13), P('hay', 12, 12),
      P('bench', 32, 7), P('planter', 20, 8), P('crate', 16, 7),
      ...PS('lantern', [[23, 8], [34, 12], [9, 12]]),
      // 東の段（北の岩柱への吊り橋）
      P('table', 36, 11), P('chair', 35, 11), P('chair', 37, 11), P('barrel', 38, 13), P('net', 30, 13),
      // 西の曲がり道と、船尾の段
      P('net', 8, 16), P('barrel', 5, 17), P('crate', 6, 17), P('flower_pot', 22, 17), P('sack', 13, 18), P('stump', 26, 17),
      // ---------------------------------------------------------------- 中の棚（網の広場・井戸・夜市・掲示板）
      P('well', 16, 23),
      P('stall', 13, 21), P('stall', 20, 25), P('board', 11, 22), P('board', 21, 21),
      ...PS('bench', [[17, 21], [8, 25]]),
      P('crate', 21, 24), P('barrel', 12, 21), P('sack', 19, 26),
      ...PS('net', [[25, 22], [18, 26]]),
      P('barrel', 26, 21), P('crate', 27, 21), P('flower_pot', 31, 21), P('hay', 23, 26),
      // 船首の台
      P('barrel', 40, 26), P('crate', 33, 26), P('net', 37, 26), P('lantern', 36, 25),
      // ---------------------------------------------------------------- 下の段（遊歩道）
      ...PS('bollard', [[4, 32], [14, 32], [27, 31], [37, 32], [43, 32], [52, 32], [59, 31]]),
      P('net', 17, 29), P('net', 33, 29), P('crate', 25, 29), P('crate', 26, 29), P('barrel', 27, 29), P('barrel', 3, 29), P('sack', 4, 29),
      P('barrel', 36, 29), P('hay', 41, 29), P('crate', 50, 30), P('sack', 51, 30),
      ...PS('lantern', [[8, 32], [26, 32], [56, 32]]),
      // 桟橋と船
      ...PS('bollard', [[9, 38], [13, 42], [19, 42], [27, 42], [29, 37], [46, 39]]),
      ...PS('lantern', [[10, 36], [24, 39], [35, 37], [47, 36]]),
      P('ship', 16, 40), P('ship', 36, 42), P('ship', 53, 37),
      ...PS('rowboat', [[6, 36], [26, 36], [44, 35], [15, 35]]),
      // ---------------------------------------------------------------- 北の岩柱・東の岩柱
      P('barrel', 46, 9), P('crate', 46, 12), P('net', 54, 12),
      P('crate', 61, 21), P('barrel', 52, 24), P('net', 59, 24), P('bollard', 60, 19), P('lantern', 54, 21),

      // ---------------------------------------------------------------- 調べる物・看板・宝箱
      K.sign(3, 9, '港町ファロス\n西へ出れば、半島の街道。'),
      K.sign(48, 30, '造船所\n小舟の修理、承ります。'),
      K.sign(27, 41, '定期船の桟橋\n「しばらく欠航いたします。」'),
      K.exam(11, 22, 'pharos_oilboard'),       // 油の相場の札（STORY_BIBLE §10.2 lo_pharos_oilboard）
      K.exam(21, 21, 'pharos_board'),          // 町の掲示板（依頼と張り紙）
      K.exam(61, 21, 'pharos_tract'),          // 静夜会の刷り物（lo_silent_tract）。上の crate
      K.chest('ph_c1', 55, 10, { item: 'i_ether', n: 1 }),
      K.chest('ph_c2', 49, 39, { pool: 'p_T' }),
    ]);

    // ---------------------------------------------------------------- 人
    const npcs = [
      { id: 'otto', look: 'otto', name: 'オットー', title: '灯台守', x: 21, y: 30, dir: 's', move: 'still', pushable: false, talk: 'pharos_otto', reward: 'item', key: 'pharos_otto' },
      { id: 'gateguard', look: 'npc_guard_1', name: '門番', x: 2, y: 12, dir: 'e', move: 'still', pushable: false, talk: 'pharos_gateguard', reward: 'news', key: 'pharos_gateguard', bark: 'v_gateguard_greet_01' },
      { id: 'well_child', look: 'npc_child_2', x: 18, y: 22, dir: 's', move: { route: [[18, 22], [18, 24], [14, 24], [14, 22]], wait: 1400 }, talk: 'pharos_well_child', reward: 'side', key: 'pharos_well_child' },
      { id: 'tadeo', look: 'npc_tadeo', name: 'タデオ', title: '灯守組合の油売り', x: 11, y: 23, dir: 'n', move: 'still', talk: 'pharos_tadeo', reward: 'side', key: 'pharos_tadeo', bark: 'v_tadeo_greet_01' },
      { id: 'fishwife', look: 'npc_woman_3', x: 17, y: 30, dir: 's', move: 'still', talk: 'pharos_fishwife', reward: 'item', key: 'pharos_fishwife', bark: 'v_fishwife_greet_01' },
      { id: 'old_sailor', look: 'npc_sailor_2', x: 53, y: 11, dir: 'e', move: 'still', talk: 'pharos_old_sailor', reward: 'hint', key: 'pharos_old_sailor' },
      { id: 'ship_sailor', look: 'npc_sailor_1', x: 56, y: 22, dir: 'e', move: 'wander', talk: 'pharos_ship_sailor', reward: 'news', key: 'pharos_ship_sailor' },
      { id: 'plaza_woman', look: 'npc_woman_1', x: 19, y: 23, dir: 's', move: 'wander', talk: 'pharos_plaza_woman', reward: 'news', key: 'pharos_plaza_woman' },
      { id: 'bench_old', look: 'npc_old_m_2', x: 31, y: 7, dir: 's', move: 'still', talk: 'pharos_bench_old', reward: 'news', key: 'pharos_bench_old' },
      { id: 'merchant', look: 'npc_merchant_1', x: 31, y: 12, dir: 's', move: { route: [[30, 12], [38, 12]], wait: 1800 }, talk: 'pharos_merchant', reward: 'discount', key: 'pharos_merchant' },
      { id: 'yena', look: 'npc_yena', name: 'イェナ', title: '静夜会', x: 60, y: 22, dir: 'e', move: 'still', talk: 'pharos_yena', reward: null, key: 'pharos_yena' },
      { id: 'kid_pier', look: 'npc_child_4', x: 13, y: 41, dir: 's', move: 'still', talk: 'pharos_kid_pier', reward: 'news', key: 'pharos_kid_pier' },
      { id: 'dog', look: 'ani_dog', name: 'いぬ', x: 35, y: 31, dir: 'e', move: 'wander', talk: { lines: [{ text: 'いぬが、しっぽをふっている。' }] } },
      // P10 の朝の場面だけの人（prologue_boss の後、prologue_done の前）。宿の前（inn_front 6,10）に集まる
      { id: 'berna', look: 'berna', name: 'ベルナ', x: 7, y: 11, dir: 'n', move: 'still', pushable: false, cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
      { id: 'cheer_a', look: 'npc_man_1', x: 4, y: 10, dir: 'e', move: 'still', cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
      { id: 'cheer_b', look: 'npc_woman_1', x: 9, y: 10, dir: 'w', move: 'still', cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
    ];

    K.def('pharos', {
      name: '港町ファロス', name_ruby: 'みなとまちふぁろす', kind: 'town', region: 'prologue', location: 'pharos', theme: 'harbor',
      legend, rows: g, outside: 'sea', objects, npcs,
      spawns: {
        gate_w: { x: 2, y: 10, dir: 'e' }, harbor: { x: 24, y: 31, dir: 's' }, warp: { x: 18, y: 24, dir: 's' }, inn_front: { x: 6, y: 10, dir: 's' },
        inn_door: { x: 6, y: 9, dir: 's' }, tavern_door: { x: 24, y: 17, dir: 's' }, shop_door: { x: 34, y: 24, dir: 's' },
        record_door: { x: 28, y: 8, dir: 's' }, smith_door: { x: 30, y: 20, dir: 's' }, shipyard_door: { x: 44, y: 31, dir: 's' },
        house1_door: { x: 21, y: 7, dir: 's' }, house2_door: { x: 13, y: 11, dir: 's' }, house3_door: { x: 49, y: 9, dir: 's' },
        house4_door: { x: 6, y: 24, dir: 's' }, house5_door: { x: 15, y: 29, dir: 's' }, house6_door: { x: 30, y: 36, dir: 's' },
      },
      exits: [{ x: 0, y: 10, w: 1, h: 2, to: { map: 'world', spawn: 'pharos' } }],
      triggers: [{ id: 'arrival', on: 'enter', event: 'pharos_arrival' }],
      light: { ambient: '#5c5aa0', k: 0.45, mood: 'town_night' }, bgm: 'town',
      meta: { sub: '潮風と灯台の町', chestsInfo: true },
      // 町ぜんたいを 1 枚に描いた下絵（v2/assets/env/harbor/under/pharos*、design/ENV_ASSETS.md §7）。地面・崖・建物・橋・桟橋はこの絵、
      // 当たり・戸口・人・灯り・ほかの物は上のデータのまま。over = 吊り橋の手前の綱（人より上）。絵が無ければマスから焼く
      art: { image: 'harbor/under/pharos', overlay: 'harbor/under/pharos_over', emit: 'harbor/under/pharos_emit', painted: [] },
    });
  });
})(window.RPG);
