// CONTENT-P: 港町ファロス（pharos、町 64×48）。V2_PLAN §3.2・§3.3 P4〜P7・P10、WORLD_REDESIGN §5.3、STORY_BIBLE §8.1・§9.1
//   上の町（石畳、x 2〜42・y 3〜29）: 北の列に宿・潮風亭・道具屋、中の列に記録院の出張所・武具屋、まん中に噴水の広場（夜市の屋台、掲示板）。
//   擁壁（y 30 と x 43）の下が板の遊歩道（L 字）、南と東へ桟橋が枝分かれし、船の間を歩く。定期船の桟橋は東（縦切りでは船が出ない）。
//   門は西（ワールドへ）。灯りの形 = 灯台（序章の後、岬の灯が町を掃く）と船の灯。宝箱 2。出現なし。
//   spawns: gate_w（西の門、ワールドから）・warp（広場）・inn_front（P10 の朝の場面）・<建物>_door（屋内から戻る所）
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const { rect, put, hline, vline } = K;
    const W = 64, H = 48, g = K.grid(W, H, '~');

    // ---------------------------------------------------------------- 地面
    rect(g, 0, 0, 52, 3, 'R');                 // 北の崖
    rect(g, 0, 0, 52, 1, 'T');
    rect(g, 2, 3, 41, 27, 'c');                // 上の町（石畳）
    vline(g, 0, 3, 29, 'Q'); vline(g, 1, 3, 29, 'Q');   // 西の町壁
    rect(g, 0, 18, 2, 2, '.');                 // 西の門
    rect(g, 19, 13, 16, 12, 's');              // 噴水の広場（敷石）
    hline(g, 0, 43, 30, 'Q');                  // 南の擁壁
    vline(g, 43, 3, 30, 'Q');                  // 東の擁壁
    rect(g, 12, 30, 2, 1, 'e'); rect(g, 30, 30, 2, 1, 'e');   // 遊歩道へ下りる石段
    rect(g, 43, 12, 1, 2, 'e');
    rect(g, 0, 31, 52, 5, 'p');                // 南の遊歩道（板）
    rect(g, 44, 3, 8, 33, 'p');                // 東の遊歩道
    rect(g, 52, 0, 12, 48, '~');
    // 桟橋: 南へ 3 本、東へ 2 本
    rect(g, 7, 36, 2, 7, 'p'); rect(g, 22, 36, 3, 10, 'p'); rect(g, 36, 36, 2, 6, 'p');
    rect(g, 52, 9, 8, 2, 'p'); rect(g, 52, 21, 11, 3, 'p');
    rect(g, 20, 44, 7, 2, 'p');                // 定期船の桟橋の先（T 字）
    // 南の擁壁の上の花壇
    for (const x of [4, 5, 20, 21, 38, 39]) put(g, x, 28, 'o');

    const legend = {
      c: { mat: 'cobble' }, s: { mat: 'stone_floor' }, '.': { mat: 'road' }, o: { mat: 'flowers' },
      T: { mat: 'tree', solid: true }, R: { mat: 'cliff', solid: true, rise: 1 }, Q: { mat: 'wall_stone', solid: true, rise: 1 },
      e: { mat: 'stone_floor', name: 'stairs' }, p: { mat: 'pier' }, '~': { mat: 'sea', walk: false },
    };

    // ---------------------------------------------------------------- 建物
    const b = K.b, P = K.prop, PS = K.props;
    const door = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });
    const objects = [
      b('ph_inn', 3, 3, 8, 6, { wall: 3, roof: 'slate', mat: 'plaster', windows: 3, sign: 'inn', lamp: true, flowers: true, door: door(6, 8, 'pharos_inn') }),
      b('ph_tavern', 12, 3, 11, 6, { wall: 3, roof: 'terra', mat: 'stone', windows: 4, sign: 'tavern', lamp: true, hip: true, chimney: true, door: door(17, 8, 'pharos_tavern') }),
      b('ph_shop', 25, 3, 6, 6, { wall: 3, roof: 'slate', mat: 'plaster', windows: 2, sign: 'item', lamp: true, awning: true, door: door(27, 8, 'pharos_shop') }),
      b('ph_house1', 32, 3, 5, 6, { wall: 3, roof: 'terra', mat: 'plaster', windows: 2, shutters: 'b' }),
      b('ph_house2', 38, 3, 5, 6, { wall: 3, roof: 'slate', mat: 'brick', windows: 2, chimney: true }),
      b('ph_record', 3, 12, 7, 6, { wall: 3, roof: 'slate', mat: 'stone', windows: 2, sign: 'records', lamp: true, door: door(6, 17, 'pharos_record') }),
      b('ph_smith', 11, 12, 7, 6, { wall: 3, roof: 'shingle', mat: 'brick', windows: 2, sign: 'weapon', lamp: true, chimney: true, door: door(14, 17, 'pharos_smith') }),
      b('ph_house3', 36, 13, 6, 5, { wall: 2, roof: 'terra', mat: 'plaster', windows: 2, flowers: true }),
      b('ph_house4', 3, 20, 6, 5, { wall: 2, roof: 'slate', mat: 'plaster', windows: 2, shutters: 'g' }),
      b('ph_house5', 10, 20, 7, 5, { wall: 2, roof: 'terra', mat: 'plaster', windows: 2, flowers: true, chimney: true }),
      b('ph_house6', 36, 20, 6, 5, { wall: 2, roof: 'slate', mat: 'brick', windows: 2 }),
      b('ph_shipyard', 45, 16, 6, 6, { wall: 3, roof: 'shingle', mat: 'plank', windows: 1, sign: 'guild', lamp: true, door: door(47, 21, 'pharos_shipyard') }),

      // ---------------------------------------------------------------- 広場（噴水・夜市・掲示板）
      P('well', 26, 18),
      ...PS('lamp_post', [[20, 14], [33, 14], [20, 23], [33, 23], [26, 13]]),
      P('stall', 22, 22), P('stall', 30, 22), P('board', 21, 14), P('board', 23, 22),
      ...PS('bench', [[24, 20], [28, 20]]),
      ...PS('flower_pot', [[19, 13], [34, 13], [19, 24], [34, 24]]),
      P('crate', 31, 21), P('barrel', 21, 21), P('sack', 29, 22),
      // 北の通り
      ...PS('lamp_post', [[2, 10], [11, 10], [24, 10], [31, 10], [42, 10]]),
      ...PS('barrel', [[11, 8], [23, 8], [23, 7]]), P('crate', 31, 8), P('crate', 24, 8), P('sack', 37, 9),
      ...PS('flower_pot', [[2, 9], [10, 9], [37, 8]]), P('bench', 33, 11), P('table', 20, 10), P('chair', 19, 10), P('chair', 21, 10),
      // 中の列と南の通り
      ...PS('lamp_post', [[2, 21], [18, 18], [35, 18], [2, 26], [18, 26], [35, 27]]),
      P('barrel', 10, 17), P('barrel', 18, 12), P('crate', 18, 13), P('planter', 9, 19),
      ...PS('bench', [[6, 27], [25, 27]]), P('table', 14, 27), P('chair', 13, 27), P('chair', 15, 27),
      P('barrel', 34, 28), P('barrel', 35, 28), P('crate', 33, 28), P('sack', 41, 27), P('hay', 42, 26),
      P('flower_pot', 9, 28), P('flower_pot', 27, 28), P('stump', 42, 19), P('rock_small', 2, 24),
      // 遊歩道
      ...PS('lamp_post', [[3, 32], [16, 32], [27, 32], [40, 32], [48, 32], [48, 24], [48, 12], [48, 4]]),
      ...PS('bollard', [[5, 35], [11, 35], [19, 35], [27, 35], [33, 35], [41, 35], [51, 7], [51, 14], [51, 26], [51, 30]]),
      P('net', 13, 34), P('net', 44, 33), P('crate', 30, 34), P('crate', 31, 34), P('barrel', 32, 34), P('barrel', 1, 33), P('sack', 2, 33),
      P('barrel', 45, 8), P('barrel', 45, 9), P('crate', 50, 5), P('crate', 50, 18), P('sack', 45, 26), P('net', 50, 28), P('hay', 45, 4),
      // 桟橋と船
      ...PS('bollard', [[7, 42], [8, 42], [22, 45], [26, 45], [36, 41], [59, 9], [62, 21], [62, 23]]),
      ...PS('lantern', [[9, 40], [25, 40], [38, 40], [59, 10], [61, 22]]),
      P('ship', 18, 41), P('ship', 57, 18), P('ship', 57, 26),
      ...PS('rowboat', [[10, 38], [34, 38], [55, 12], [40, 44]]),
      // 西の門
      P('lamp_post', 2, 12),

      // ---------------------------------------------------------------- 調べる物・看板・宝箱
      K.sign(2, 16, '港町ファロス\n西へ出れば、半島の街道。'),
      K.sign(47, 22, '造船所\n小舟の修理、承ります。'),
      K.sign(25, 44, '定期船の桟橋\n「しばらく欠航いたします。」'),
      K.exam(23, 22, 'pharos_oilboard'),       // 油の相場の札（STORY_BIBLE §10.2 lo_pharos_oilboard）
      K.exam(21, 14, 'pharos_board'),          // 町の掲示板（依頼と張り紙）
      K.exam(61, 21, 'pharos_tract'), P('crate', 61, 21),          // 静夜会の刷り物（lo_silent_tract）
      K.chest('ph_c1', 50, 3, { item: 'i_ether', n: 1 }),
      K.chest('ph_c2', 37, 40, { pool: 'p_T' }),
    ];

    // ---------------------------------------------------------------- 人
    const npcs = [
      { id: 'otto', look: 'otto', name: 'オットー', title: '灯台守', x: 24, y: 34, dir: 's', move: 'still', pushable: false, talk: 'pharos_otto', reward: 'item', key: 'pharos_otto' },
      { id: 'gateguard', look: 'npc_guard_1', name: '門番', x: 2, y: 20, dir: 'e', move: 'still', pushable: false, talk: 'pharos_gateguard', reward: 'news', key: 'pharos_gateguard' },
      { id: 'well_child', look: 'npc_child_2', x: 27, y: 20, dir: 's', move: { route: [[27, 20], [25, 20], [25, 21], [27, 21]], wait: 1400 }, talk: 'pharos_well_child', reward: 'side', key: 'pharos_well_child' },
      { id: 'tadeo', look: 'npc_tadeo', name: 'タデオ', title: '灯守組合の油売り', x: 23, y: 23, dir: 'n', move: 'still', talk: 'pharos_tadeo', reward: 'side', key: 'pharos_tadeo' },
      { id: 'fishwife', look: 'npc_woman_3', x: 14, y: 33, dir: 's', move: 'still', talk: 'pharos_fishwife', reward: 'item', key: 'pharos_fishwife' },
      { id: 'old_sailor', look: 'npc_sailor_2', x: 47, y: 13, dir: 'w', move: 'still', talk: 'pharos_old_sailor', reward: 'hint', key: 'pharos_old_sailor' },
      { id: 'ship_sailor', look: 'npc_sailor_1', x: 57, y: 22, dir: 'e', move: 'wander', talk: 'pharos_ship_sailor', reward: 'news', key: 'pharos_ship_sailor' },
      { id: 'plaza_woman', look: 'npc_woman_1', x: 29, y: 16, dir: 's', move: 'wander', talk: 'pharos_plaza_woman', reward: 'news', key: 'pharos_plaza_woman' },
      { id: 'bench_old', look: 'npc_old_m_2', x: 6, y: 26, dir: 's', move: 'still', talk: 'pharos_bench_old', reward: 'news', key: 'pharos_bench_old' },
      { id: 'merchant', look: 'npc_merchant_1', x: 30, y: 11, dir: 's', move: { route: [[28, 11], [34, 11]], wait: 1800 }, talk: 'pharos_merchant', reward: 'discount', key: 'pharos_merchant' },
      { id: 'yena', look: 'npc_yena', name: 'イェナ', title: '静夜会', x: 59, y: 22, dir: 'e', move: 'still', talk: 'pharos_yena', reward: null, key: 'pharos_yena' },
      { id: 'kid_pier', look: 'npc_child_4', x: 8, y: 38, dir: 's', move: 'still', talk: 'pharos_kid_pier', reward: 'news', key: 'pharos_kid_pier' },
      { id: 'dog', look: 'ani_dog', name: 'いぬ', x: 16, y: 29, dir: 'e', move: 'wander', talk: { lines: [{ text: 'いぬが、しっぽをふっている。' }] } },
      // P10 の朝の場面だけの人（prologue_boss の後、prologue_done の前）
      { id: 'berna', look: 'berna', name: 'ベルナ', x: 7, y: 11, dir: 'n', move: 'still', pushable: false, cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
      { id: 'cheer_a', look: 'npc_man_1', x: 4, y: 10, dir: 'e', move: 'still', cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
      { id: 'cheer_b', look: 'npc_woman_1', x: 9, y: 10, dir: 'w', move: 'still', cond: ['prologue_boss', '!prologue_done'], talk: 'pharos_departure' },
    ];

    K.def('pharos', {
      name: '港町ファロス', name_ruby: 'みなとまちふぁろす', kind: 'town', region: 'prologue', location: 'pharos', theme: 'harbor',
      legend, rows: g, outside: 'sea', objects, npcs,
      spawns: {
        gate_w: { x: 2, y: 18, dir: 'e' }, harbor: { x: 24, y: 32, dir: 's' }, warp: { x: 26, y: 21, dir: 's' }, inn_front: { x: 6, y: 10, dir: 's' },
        inn_door: { x: 6, y: 9, dir: 's' }, tavern_door: { x: 17, y: 9, dir: 's' }, shop_door: { x: 27, y: 9, dir: 's' },
        record_door: { x: 6, y: 18, dir: 's' }, smith_door: { x: 14, y: 18, dir: 's' }, shipyard_door: { x: 47, y: 22, dir: 's' },
      },
      exits: [{ x: 0, y: 18, w: 1, h: 2, to: { map: 'world', spawn: 'pharos' } }],
      triggers: [{ id: 'arrival', on: 'enter', event: 'pharos_arrival' }],
      light: { ambient: '#5c5aa0', k: 0.45, mood: 'town_night' }, bgm: 'town',
      meta: { sub: '潮風と灯台の町', chestsInfo: true },
    });
  });
})(window.RPG);
