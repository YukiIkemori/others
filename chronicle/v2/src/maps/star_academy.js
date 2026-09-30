// CONTENT（オルビス高原）: 消灯後の学院 2 階（WORLD_REDESIGN §4.8・§6.5・§6.6 の E10、STORY_BIBLE §7.8）。
//   1 階 star_academy_1（48×40）: 洗濯場の側の勝手口（南西。ここから忍びこむ・出る）→ 南の廊下 → 中庭（噴水。見回りの死角。泉は置かない = 短いダンジョン。
//        口は北と南の真ん中だけ）→ 北の廊下 → 階段の広間（上り口）。東西の教室 4 つ（黒板 3 枚に文字盤の数。机の列）。
//        見回り 3 人（南の廊下・東の廊下・北の廊下。ランタンの前の 3 マスに入ると見つかる。systems/field/watch.js）と、
//        西の教室で夜ふかしの学生（制服を着ていれば騒がない）。大扉（南）は内からかんぬき。
//   2 階 star_academy_2（48×40）: 階段 → 回廊 → 真ん中の廊下の奥に保管庫の鉄の扉（文字盤。開けるまでは閉じた扉）。
//        西は書庫（本棚の列）、東は学長室（夜は学長が待っている）と講義室。見回り 2 人（回廊・真ん中の廊下）。
//   魔物は出ない（見つかっても外につまみ出されるだけ。「押し通る」を選ぶと守衛が呼ぶ夜番の鎧と戦う）。隠し通路なし（A27）。
//   灯りは落ちている（消灯の刻）: 窓の星明かりの薄い光（star_glow）と、見張りのランタン。当たりは下絵に合わせた star_painted_rows.js。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, SK = R.Star.kit;
    const WATCH = (o) => Object.assign({ range: 3, event: 'star_caught', routeFlag: 'star_prep_route' }, o || {});
    const guard = (id, x, y, route, o) => K.npc(id, 'npc_night_guard', x, y, Object.assign({
      name: R.T('map.star_academy.guard.name'), dir: 's', talk: 'star_caught', pushable: false, move: { route, wait: 1400, speed: 0.8 }, watch: WATCH(), cond: `!star_down_${id}`,
    }, o || {}));

    // ================================================================ 1 階
    {
      const P = SK.painted('star_academy_1');
      const O = [];
      O.push({ type: 'door', x: 6, y: 36, look: 'none', to: { map: 'orbis', spawn: 'academy' }, confirm: R.T('map.star_academy.confirm') });
      O.push(K.stairs(23, 3, { map: 'star_academy_2', spawn: 'up' }, { id: 'star_academy_1_up', look: 'up' }), K.stairs(24, 3, { map: 'star_academy_2', spawn: 'up' }, { look: 'up' }));
      O.push(K.exam(7, 4, 'star_board', { board: 1 }), K.exam(40, 4, 'star_board', { board: 2 }), K.exam(7, 16, 'star_board', { board: 3 }), K.exam(40, 16, 'star_board_blank'));
      O.push(K.exam(23, 35, 'star_great_door'), K.exam(24, 35, 'star_great_door'));
      O.push(K.chest('star_academy_1_c1', 42, 12, { pool: 'p_T' }), K.chest('star_academy_1_c2', 4, 25, { item: 'i_ether', n: 1 }));
      for (const [x, y] of [[20, 13], [28, 25], [8, 12], [39, 24], [24, 5]]) O.push(K.prop('star_glow', x, y));
      const N = [
        guard('guard_s', 8, 30, [[5, 30], [42, 30]]),
        guard('guard_e', 34, 26, [[34, 28], [34, 11]], { dir: 'n' }),
        guard('guard_n', 30, 9, [[13, 9], [33, 9]], { dir: 'w', move: { route: [[13, 9], [33, 9]], wait: 2200, speed: 0.7 } }),
        K.npc('night_student', 'npc_student', 6, 21, { name: R.T('map.star_academy.N.3.night_student.name'), dir: 's', move: 'wander', radius: 2, talk: 'star_student_shout',
          watch: { range: 2, event: 'star_student_shout', cond: '!star_prep_uniform' } }),
      ];
      K.def('star_academy_1', {
        name: R.T('map.star_academy.star_academy_1.name'), kind: 'dungeon', region: 'r_star', location: 'academy', theme: 'lighthouse', propSet: 'star',
        legend: SK.INT(), rows: P.rows, outside: 'wall_stone', objects: O, npcs: N,
        spawns: { service: { x: 6, y: 35, dir: 'n' }, from2: { x: 23, y: 4, dir: 's' } },
        exits: [],
        triggers: [{ id: 'arrive', on: 'enter', event: 'star_academy_arrive' }],
        zones: [],
        light: SK.LIGHT_ACADEMY, dark: false, bgm: 'tension', bbg: 'tower',
        art: Object.assign({}, P.art, { painted: ['star_glow'] }),
        meta: { chestsInfo: true, floor: R.T('map.star_academy.star_academy_1.meta.floor'), sub: R.T('map.star_academy.star_academy_1.meta.sub') },
      });
    }

    // ================================================================ 2 階
    {
      const P = SK.painted('star_academy_2');
      const O = [];
      O.push(K.stairs(23, 36, { map: 'star_academy_1', spawn: 'from2' }, { id: 'star_academy_2_down', look: 'down' }), K.stairs(24, 36, { map: 'star_academy_1', spawn: 'from2' }, { look: 'down' }));
      O.push(K.exam(23, 8, 'star_vault_lock', { cond: '!star_vault_open' }), K.exam(24, 8, 'star_vault_lock', { cond: '!star_vault_open' }));
      O.push(K.exam(23, 4, 'star_vault_chart'), K.exam(24, 4, 'star_vault_chart'), K.exam(26, 3, 'star_vault_bundle'), K.exam(21, 3, 'star_vault_cabinet'));
      O.push(K.exam(37, 6, 'star_octavia_desk'), K.exam(36, 17, 'star_lecture_lectern'));
      O.push(K.chest('star_academy_2_c1', 4, 13, { pool: 'p_T' }), K.chest('star_academy_2_c2', 43, 26, { gold: 240 }));
      for (const [x, y] of [[10, 10], [10, 20], [36, 12], [36, 24], [23, 6]]) O.push(K.prop('star_glow', x, y));
      const N = [
        guard('guard_g', 38, 30, [[5, 30], [42, 30]], { dir: 'w' }),
        guard('guard_c', 22, 20, [[22, 27], [22, 12]], { dir: 'n', move: { route: [[22, 27], [22, 12]], wait: 2400, speed: 0.7 } }),
        K.npc('octavia_night', 'npc_octavia', 36, 9, { name: R.T('map.star_academy.N.2.octavia_night.name'), dir: 's', talk: 'star_octavia_night', reward: 'lead', pushable: false, cond: ['star_night_seen', '!star_octavia_done'] }),
      ];
      K.def('star_academy_2', {
        name: R.T('map.star_academy.star_academy_2.name'), kind: 'dungeon', region: 'r_star', location: 'academy', theme: 'lighthouse', propSet: 'star',
        legend: SK.INT(), rows: P.rows, outside: 'wall_stone', objects: O, npcs: N,
        spawns: { up: { x: 23, y: 35, dir: 'n' }, office: { x: 35, y: 10, dir: 'n' } },
        exits: [],
        // 保管庫の鉄の扉: 開けるまでは閉じている（下絵は閉じた扉の絵。開けた後は通れる）
        tilePatches: [{ cond: '!star_vault_open', rect: [23, 8, 2, 1], rows: ['XX'] }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'star_academy2_arrive' }],
        zones: [],
        light: SK.LIGHT_ACADEMY, dark: false, bgm: 'tension', bbg: 'tower',
        art: Object.assign({}, P.art, { painted: ['star_glow'] }),
        meta: { chestsInfo: true, floor: R.T('map.star_academy.star_academy_2.meta.floor'), sub: R.T('map.star_academy.star_academy_2.meta.sub') },
      });
    }
  });
})(window.RPG);
