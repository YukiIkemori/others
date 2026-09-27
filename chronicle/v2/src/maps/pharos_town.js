// CONTENT-P: 港町ファロス（pharos、町 64×48）。V2_PLAN §3.2・§3.3 P4〜P7・P10、WORLD_REDESIGN §5.3、STORY_BIBLE §8.1・§9.1
//   崖にしがみつく港町。四角い家の並ぶ町ではなく、崖の段と海の岩の塔（岩柱）に住む町:
//   上の段（崖の上、y 9〜14）: 北の岩壁を掘った住まい（宿・記録院の出張所・武具屋の鍛冶場・家 2 つ）。門は西（ワールドへ）。
//   中の段（y 17〜26）      : 網を干す石畳の広場（井戸・夜市の屋台・掲示板）と、ひっくり返した古い船の胴の建物（潮風亭・道具屋・家）。
//   下の段（海ぎわ、y 29〜33）: 崖の根もとの板の遊歩道。崖の面を掘った家 2 つ、杭の上の造船所、南へ桟橋 3 本（定期船は中の桟橋）。
//   東の海の岩柱 2 つ     : 北の岩柱（家 1 つ・見張りの老水夫）と東の岩柱（静夜会のイェナ）。上の段・中の段・岩柱どうしを吊り橋でつなぐ。
//   段と段は石段（2 マス幅）。歩くと上り下りをくり返す。南東の沖に灯台の岩が見える。
//   灯りの形 = 灯台（序章の後、岬の灯が町を掃く）・船の灯・崖の窓明かり。宝箱 2。出現なし。
//   spawns: gate_w（西の門、ワールドから）・warp（広場）・inn_front（P10 の朝の場面）・harbor・<建物>_door（屋内から戻る所）
//   町の絵は 1 枚の下絵（v2/assets/env/harbor/under/pharos*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const { rect, put } = K;
    const W = 64, H = 48, g = K.grid(W, H, '~');

    // ---------------------------------------------------------------- 地面
    // 北の岩壁（上の 2 行は崖の上の草）。上の段の家はこの壁を掘った住まい
    rect(g, 0, 0, 42, 9, '#');
    rect(g, 0, 9, 2, 6, '#');
    rect(g, 2, 9, 38, 6, 'k');                 // 上の段（x 2〜39、y 9〜14）
    rect(g, 0, 11, 2, 2, 'k');                 // 西の門（ワールドへ）
    rect(g, 40, 9, 2, 6, '#');                 // 上の段の東の縁
    rect(g, 2, 13, 3, 2, 'g'); rect(g, 36, 13, 4, 2, 'g');   // 崖の縁の草
    // 上の段 → 中の段の崖（y 15〜16）と石段
    rect(g, 0, 15, 44, 2, '#');
    rect(g, 14, 15, 2, 2, 'e'); rect(g, 30, 15, 2, 2, 'e');
    // 中の段（x 3〜42、y 17〜26）と網の広場
    rect(g, 0, 17, 3, 10, '#');
    rect(g, 3, 17, 40, 10, 'k');
    rect(g, 16, 18, 16, 8, 'c');
    // 中の段 → 下の段の崖（y 27〜28）と石段
    rect(g, 0, 27, 45, 2, '#');
    rect(g, 14, 27, 2, 2, 'e'); rect(g, 27, 27, 2, 2, 'e');
    rect(g, 45, 24, 6, 5, 'p');                // 杭の上の造船所の床
    // 下の段: 崖の根もとの板の遊歩道（x 2〜59、y 29〜33。東は y 31 まで）
    rect(g, 0, 29, 2, 5, '#'); rect(g, 0, 32, 2, 2, 'p');   // 遊歩道の西の端（絵の板に合わせる）
    rect(g, 2, 29, 51, 5, 'p');
    rect(g, 53, 29, 7, 3, 'p');
    rect(g, 2, 29, 43, 1, 'k');                // 崖の根もとの岩の縁（遊歩道の北の 1 行）
    // 南の桟橋 3 本（中は定期船の桟橋、先が T 字）
    rect(g, 6, 34, 3, 8, 'p');
    rect(g, 22, 34, 3, 9, 'p'); rect(g, 19, 43, 9, 2, 'p');
    rect(g, 36, 34, 2, 7, 'p');
    // 北の岩柱（x 44〜55、y 2〜14。上は x 45〜54、y 8〜12）: 上の段から吊り橋
    rect(g, 44, 2, 12, 13, '#');
    rect(g, 45, 8, 10, 5, 'k');
    rect(g, 40, 11, 5, 2, 'b');
    // 東の岩柱（x 51〜62、y 17〜26。上は x 52〜61、y 18〜24）: 中の段から吊り橋、北の岩柱から石段と吊り橋、南の石段で遊歩道へ
    rect(g, 51, 17, 12, 10, '#');
    rect(g, 52, 18, 10, 7, 'k');
    rect(g, 43, 21, 9, 2, 'b');
    rect(g, 53, 13, 2, 2, 'e'); rect(g, 53, 15, 2, 3, 'b');
    rect(g, 55, 25, 2, 2, 'e'); rect(g, 55, 27, 2, 2, 'p');
    // 南東の沖: 灯台の岩（歩けない。岬の灯台が見える）
    rect(g, 56, 37, 7, 9, '#');

    const legend = {
      k: { mat: 'stone_floor' }, c: { mat: 'cobble' }, g: { mat: 'grass' },
      '#': { mat: 'rock', solid: true, rise: 1 }, e: { mat: 'stone_floor', name: 'stairs' },
      p: { mat: 'pier' }, b: { mat: 'bridge' }, '~': { mat: 'sea', walk: false },
    };

    // ---------------------------------------------------------------- 建物（戸口は描いた扉のマス。出て着くのはその真下）
    const b = K.b, P = K.prop, PS = K.props;
    const door = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });
    const cave = { roof: 'slate', mat: 'stone', wall: 3 };   // 岩を掘った住まい（絵が無いときの控えの見た目）
    const hull = { roof: 'shingle', mat: 'plank', wall: 2 };  // ひっくり返した船の胴
    const objects = [
      // 上の段: 北の岩壁を掘った住まい
      b('ph_inn', 3, 4, 8, 5, Object.assign({}, cave, { windows: 3, sign: 'inn', lamp: true, door: door(6, 8, 'pharos_inn') })),
      b('ph_record', 11, 4, 6, 5, Object.assign({}, cave, { windows: 2, sign: 'record', lamp: true, door: door(14, 8, 'pharos_record') })),
      b('ph_house1', 19, 4, 5, 5, Object.assign({}, cave, { windows: 2, door: door(21, 8, 'pharos_home1') })),   // 家の中は homes_slice.js
      b('ph_smith', 25, 4, 7, 5, Object.assign({}, cave, { windows: 2, sign: 'weapon', lamp: true, chimney: true, door: door(28, 8, 'pharos_smith') })),
      b('ph_house2', 33, 4, 5, 5, Object.assign({}, cave, { windows: 2, door: door(35, 8, 'pharos_home2') })),
      // 中の段: 船の胴の建物
      b('ph_tavern', 3, 17, 10, 6, Object.assign({}, hull, { wall: 3, windows: 4, sign: 'tavern', lamp: true, door: door(8, 22, 'pharos_tavern') })),
      b('ph_shop', 33, 17, 5, 5, Object.assign({}, hull, { windows: 2, sign: 'item', lamp: true, door: door(35, 21, 'pharos_shop') })),
      b('ph_house4', 38, 17, 5, 4, Object.assign({}, hull, { windows: 1, door: door(40, 20, 'pharos_home4') })),
      // 中の段の崖の面を掘った家（戸は下の段へ開く）
      b('ph_house5', 3, 25, 6, 4, Object.assign({}, cave, { wall: 2, windows: 2, door: door(6, 28, 'pharos_home5') })),
      b('ph_house6', 38, 25, 5, 4, Object.assign({}, cave, { wall: 2, windows: 2, door: door(40, 28, 'pharos_home6') })),
      // 北の岩柱を掘った家
      b('ph_house3', 47, 3, 6, 5, Object.assign({}, cave, { windows: 2, door: door(49, 7, 'pharos_home3') })),
      // 杭の上の造船所
      b('ph_shipyard', 45, 24, 6, 5, { wall: 2, roof: 'shingle', mat: 'plank', windows: 1, sign: 'guild', lamp: true, door: door(47, 28, 'pharos_shipyard') }),

      // ---------------------------------------------------------------- 上の段
      // 街灯は壁・崖の際（通りの幅の端）。戸口の真下・門・石段の口には立てない（v2/tools/qa/check_lamps.js）
      ...PS('lamp_post', [[11, 9], [24, 9], [32, 9], [9, 14], [26, 14]]),
      P('bench', 20, 14), P('bench', 34, 14),
      ...PS('barrel', [[2, 9], [18, 9]]), P('crate', 17, 9), P('sack', 10, 9),
      ...PS('flower_pot', [[4, 9], [8, 9], [13, 9], [23, 9], [36, 9]]),
      P('crate', 31, 9),
      P('table', 38, 10), P('chair', 37, 10), P('chair', 39, 10),
      ...PS('lantern', [[17, 14], [29, 14], [39, 12]]),
      P('rock_small', 3, 14), P('planter', 12, 14), P('hay', 38, 14),
      // ---------------------------------------------------------------- 中の段（網の広場・井戸・夜市・掲示板）
      P('well', 23, 21),
      ...PS('lamp_post', [[15, 18], [32, 19], [15, 24], [32, 24]]),   // 広場の四隅（石畳の外の敷石）
      P('stall', 19, 24), P('stall', 27, 24), P('board', 17, 19), P('board', 20, 23),
      ...PS('bench', [[22, 19], [26, 19]]),
      P('crate', 28, 23), P('barrel', 18, 23), P('sack', 26, 24),
      ...PS('net', [[13, 18], [13, 20], [32, 23]]),
      ...PS('barrel', [[13, 22], [3, 23]]), P('crate', 4, 23), P('flower_pot', 32, 21), P('flower_pot', 37, 22),
      P('rock_small', 42, 24), P('hay', 34, 25), P('stump', 11, 25),
      // ---------------------------------------------------------------- 下の段（遊歩道）
      ...PS('lamp_post', [[10, 29], [20, 29], [37, 29], [44, 29]]),   // 崖の根もとの岩の縁
      ...PS('bollard', [[3, 33], [12, 33], [19, 33], [30, 33], [41, 33], [52, 33], [59, 31]]),
      P('net', 16, 29), P('net', 25, 29), P('net', 43, 30), P('crate', 30, 30), P('crate', 31, 30), P('barrel', 32, 30), P('barrel', 2, 29), P('sack', 3, 29),
      P('barrel', 35, 29), P('crate', 51, 29), P('sack', 52, 30), P('hay', 36, 29),
      ...PS('lantern', [[9, 33], [26, 33], [38, 33], [57, 30]]),
      // 桟橋と船
      ...PS('bollard', [[6, 41], [8, 41], [19, 44], [27, 44], [36, 40]]),
      ...PS('lantern', [[8, 38], [24, 40], [37, 37], [21, 43]]),
      P('ship', 16, 40), P('ship', 31, 40), P('ship', 46, 38),
      ...PS('rowboat', [[10, 36], [34, 36], [4, 38], [42, 35]]),
      // ---------------------------------------------------------------- 北の岩柱・東の岩柱
      P('lamp_post', 45, 8), P('barrel', 54, 8), P('crate', 45, 12), P('net', 50, 12),
      P('lamp_post', 52, 18), P('crate', 61, 21), P('barrel', 52, 24), P('net', 59, 24), P('bollard', 61, 18),
      P('lantern', 54, 22),

      // ---------------------------------------------------------------- 調べる物・看板・宝箱
      K.sign(2, 10, '港町ファロス\n西へ出れば、半島の街道。'),
      K.sign(50, 29, '造船所\n小舟の修理、承ります。'),
      K.sign(25, 44, '定期船の桟橋\n「しばらく欠航いたします。」'),
      K.exam(20, 23, 'pharos_oilboard'),       // 油の相場の札（STORY_BIBLE §10.2 lo_pharos_oilboard）
      K.exam(17, 19, 'pharos_board'),          // 町の掲示板（依頼と張り紙）
      K.exam(61, 21, 'pharos_tract'),          // 静夜会の刷り物（lo_silent_tract）。上の crate
      K.chest('ph_c1', 54, 12, { item: 'i_ether', n: 1 }),
      K.chest('ph_c2', 37, 40, { pool: 'p_T' }),
    ];

    // ---------------------------------------------------------------- 人
    const npcs = [
      { id: 'otto', look: 'otto', name: 'オットー', title: '灯台守', x: 21, y: 31, dir: 's', move: 'still', pushable: false, talk: 'pharos_otto', reward: 'item', key: 'pharos_otto' },
      { id: 'gateguard', look: 'npc_guard_1', name: '門番', x: 2, y: 13, dir: 'e', move: 'still', pushable: false, talk: 'pharos_gateguard', reward: 'news', key: 'pharos_gateguard', bark: 'v_gateguard_greet_01' },
      { id: 'well_child', look: 'npc_child_2', x: 25, y: 22, dir: 's', move: { route: [[25, 22], [25, 20], [21, 20], [21, 22]], wait: 1400 }, talk: 'pharos_well_child', reward: 'side', key: 'pharos_well_child' },
      { id: 'tadeo', look: 'npc_tadeo', name: 'タデオ', title: '灯守組合の油売り', x: 20, y: 24, dir: 'n', move: 'still', talk: 'pharos_tadeo', reward: 'side', key: 'pharos_tadeo', bark: 'v_tadeo_greet_01' },
      { id: 'fishwife', look: 'npc_woman_3', x: 17, y: 30, dir: 's', move: 'still', talk: 'pharos_fishwife', reward: 'item', key: 'pharos_fishwife', bark: 'v_fishwife_greet_01' },
      { id: 'old_sailor', look: 'npc_sailor_2', x: 52, y: 10, dir: 'e', move: 'still', talk: 'pharos_old_sailor', reward: 'hint', key: 'pharos_old_sailor' },
      { id: 'ship_sailor', look: 'npc_sailor_1', x: 57, y: 21, dir: 'e', move: 'wander', talk: 'pharos_ship_sailor', reward: 'news', key: 'pharos_ship_sailor' },
      { id: 'plaza_woman', look: 'npc_woman_1', x: 28, y: 21, dir: 's', move: 'wander', talk: 'pharos_plaza_woman', reward: 'news', key: 'pharos_plaza_woman' },
      { id: 'bench_old', look: 'npc_old_m_2', x: 21, y: 14, dir: 's', move: 'still', talk: 'pharos_bench_old', reward: 'news', key: 'pharos_bench_old' },
      { id: 'merchant', look: 'npc_merchant_1', x: 30, y: 11, dir: 's', move: { route: [[27, 11], [34, 11]], wait: 1800 }, talk: 'pharos_merchant', reward: 'discount', key: 'pharos_merchant' },
      { id: 'yena', look: 'npc_yena', name: 'イェナ', title: '静夜会', x: 59, y: 22, dir: 'e', move: 'still', talk: 'pharos_yena', reward: null, key: 'pharos_yena' },
      { id: 'kid_pier', look: 'npc_child_4', x: 7, y: 39, dir: 's', move: 'still', talk: 'pharos_kid_pier', reward: 'news', key: 'pharos_kid_pier' },
      { id: 'dog', look: 'ani_dog', name: 'いぬ', x: 36, y: 31, dir: 'e', move: 'wander', talk: { lines: [{ text: 'いぬが、しっぽをふっている。' }] } },
      // P10 の朝の場面だけの人（prologue_boss の後、prologue_done の前）。宿の前（inn_front 6,10）に集まる
      { id: 'berna', look: 'berna', name: 'ベルナ', x: 7, y: 11, dir: 'n', move: 'still', pushable: false, cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
      { id: 'cheer_a', look: 'npc_man_1', x: 4, y: 10, dir: 'e', move: 'still', cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
      { id: 'cheer_b', look: 'npc_woman_1', x: 9, y: 10, dir: 'w', move: 'still', cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
    ];

    K.def('pharos', {
      name: '港町ファロス', name_ruby: 'みなとまちふぁろす', kind: 'town', region: 'prologue', location: 'pharos', theme: 'harbor',
      legend, rows: g, outside: 'sea', objects, npcs,
      spawns: {
        gate_w: { x: 2, y: 11, dir: 'e' }, harbor: { x: 24, y: 32, dir: 's' }, warp: { x: 24, y: 23, dir: 's' }, inn_front: { x: 6, y: 10, dir: 's' },
        inn_door: { x: 6, y: 9, dir: 's' }, tavern_door: { x: 8, y: 23, dir: 's' }, shop_door: { x: 35, y: 22, dir: 's' },
        record_door: { x: 14, y: 9, dir: 's' }, smith_door: { x: 28, y: 9, dir: 's' }, shipyard_door: { x: 47, y: 29, dir: 's' },
        house1_door: { x: 21, y: 9, dir: 's' }, house2_door: { x: 35, y: 9, dir: 's' }, house3_door: { x: 49, y: 8, dir: 's' },
        house4_door: { x: 40, y: 21, dir: 's' }, house5_door: { x: 6, y: 29, dir: 's' }, house6_door: { x: 40, y: 29, dir: 's' },
      },
      exits: [{ x: 0, y: 11, w: 1, h: 2, to: { map: 'world', spawn: 'pharos' } }],
      triggers: [{ id: 'arrival', on: 'enter', event: 'pharos_arrival' }],
      light: { ambient: '#5c5aa0', k: 0.45, mood: 'town_night' }, bgm: 'town',
      meta: { sub: '潮風と灯台の町', chestsInfo: true },
    });
  });
})(window.RPG);
