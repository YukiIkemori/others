// CONTENT（灰の荒野）: カルデラの闘技場（caldera_arena、40×32、屋内）。WORLD_REDESIGN §4.7・§5.11、STORY_BIBLE §7.7。
//   丸い闘技場の内側: まん中に砂の闘技の場。まわりは石の観客席（段々。通れない）。北の観客席のまん中に族長の席。
//   西の観客席の柱に小さな銘板（「光暦 292 年　冬至の前夜　最後の代理試合」、削れた名が二つ = lo_time_ash）。その上が立会人の席（二十年、誰も座らない）。
//   西の観客席へは砂の場から石段の通路が上がる。
//   南は受付の広間（受付 = 大会の名簿 lo_ev_ash、賭け屋、勝ち抜きの板）。広間の西が一行の控え室（回ごとに休む）、東がザクロの控え室（荷の中の手紙）。
//   広間の北の門から砂の場へ。南の戸口（1 マス）から町へ。
//   大会の相手は砂の場に、回ごとに現れる（cond {var:'ash_bout', eq:n}、ev.appear）。
//   絵は 1 枚の下絵（v2/assets/env/ash/under/caldera_arena*）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, AK = R.Ash.kit, L = K.L;
    const W = 40, H = 32;
    const g = K.grid(W, H, 'W');
    // 観客席（外の壁の内側）と砂の場
    K.rect(g, 1, 1, W - 2, 20, 'S');
    for (let y = 1; y <= 20; y++) for (let x = 1; x < W - 1; x++) {
      const d = ((x + 0.5 - 20) / 12) ** 2 + ((y + 0.5 - 11) / 7.6) ** 2;
      if (d < 1) g[y][x] = 's';
    }
    // 西の観客席への石段の通路と、銘板の前
    K.rect(g, 3, 11, 6, 3, 'f');
    // 南の壁（観客席の下）と、砂の場への門
    K.rect(g, 0, 20, W, 2, 'W');
    K.rect(g, 19, 19, 2, 3, 's');
    // 受付の広間
    K.rect(g, 11, 22, 18, 9, 'f');
    K.rect(g, 16, 25, 8, 5, 'c');
    // 控え室（西 = 一行、東 = ザクロ）と、広間への口
    K.rect(g, 2, 22, 8, 9, 'f');
    K.rect(g, 30, 22, 8, 9, 'f');
    K.put(g, 10, 26, 'f'); K.put(g, 29, 26, 'f');
    // 町への戸口（1 マス）
    K.put(g, 19, 31, 'd');

    const O = [];
    // 受付の台・賭け屋の台
    for (const x of [13, 14, 15, 16]) O.push(K.prop('counter', x, 24));
    for (const x of [24, 25, 26]) O.push(K.prop('counter', x, 24));
    O.push(K.exam(14, 25, 'caldera_arena_roster'));                                     // 大会の名簿（lo_ev_ash）
    O.push(K.prop('board', 22, 22), K.exam(22, 23, 'caldera_arena_board'));            // 勝ち抜きの板（無敗の語り部の名）
    O.push(K.prop('arena_banner', 12, 22), K.prop('arena_banner', 27, 22));
    // 西の観客席の銘板と、その上の立会人の席
    O.push(K.exam(2, 12, 'caldera_arena_plaque'), K.exam(5, 10, 'caldera_arena_witness_seat'));
    // 控え室: 一行（休む）・ザクロ（荷）
    O.push(K.prop('bench', 3, 24), K.prop('bench', 5, 24), K.prop('bed', 2, 27), K.prop('bed', 2, 29), K.prop('water_urn', 8, 23), K.exam(5, 24, 'caldera_arena_rest'), K.exam(3, 24, 'caldera_arena_rest'));
    O.push(K.prop('bench', 34, 24), K.prop('crate', 36, 23), K.prop('ash_weapon_rack', 31, 23), K.exam(36, 23, 'caldera_arena_zakuro_bag'));
    // かがり火（観客席の上。道・戸口の前には置かない）
    for (const [x, y] of [[4, 4], [35, 4], [2, 17], [37, 17], [12, 2], [27, 2]]) O.push(K.prop('iron_brazier', x, y));
    O.push(K.prop('lantern', 11, 30), K.prop('lantern', 28, 30), K.prop('lantern', 2, 22), K.prop('lantern', 37, 22));

    const N = [
      K.npc('receptionist', 'npc_ash_woman', 15, 23, { name: '受付のミラン', dir: 's', talk: 'caldera_arena_reception', reward: 'lead', pushable: false }),
      K.npc('bookie', 'npc_ash_bookie', 25, 23, { name: '賭け屋のボッツ', dir: 's', talk: 'caldera_arena_bookie', reward: 'side', pushable: false }),
      K.npc('caldera_arena_fan', 'npc_ash_child', 20, 27, { name: '闘技好きの子', dir: 'n', talk: 'caldera_arena_fan', reward: 'hint' }),
      K.npc('caldera_arena_vet', 'npc_ash_old_m', 12, 27, { name: '古参の闘士', dir: 'e', talk: 'caldera_arena_vet', reward: 'boss' }),
      K.npc('zakuro', 'npc_zakuro', 34, 27, { name: 'ザクロ', title: '記録院付きの闘士', dir: 'w', talk: 'caldera_arena_zakuro', reward: 'lead', cond: ['ash_champion', '!ash_zakuro_gone'] }),
      K.npc('dorga_plaque', 'npc_dorga', 6, 12, { name: 'ドルガ', title: '族長', dir: 'w', talk: 'caldera_arena_dorga', reward: 'news', pushable: false, cond: 'ash_plaque_scene' }),
      // 大会の相手（回ごとに砂の場に現れる。ash_bout = 回の番号）
      K.npc('opp_1a', 'npc_ash_fighter', 18, 8, { name: '一族の若者', dir: 's', talk: [L('……。')], cond: { var: 'ash_bout', eq: 1 } }),
      K.npc('opp_1b', 'npc_ash_fighter', 22, 8, { name: '一族の若者', dir: 's', talk: [L('……。')], cond: { var: 'ash_bout', eq: 1 } }),
      K.npc('opp_2', 'npc_drake', 20, 8, { name: '獣使いのガロ', dir: 's', talk: [L('……。')], cond: { var: 'ash_bout', eq: 2 } }),
      K.npc('opp_3a', 'npc_desert_woman', 18, 8, { name: '術師の姉ヒノエ', dir: 's', talk: [L('……。')], cond: { var: 'ash_bout', eq: 3 } }),
      K.npc('opp_3b', 'npc_star_woman', 22, 8, { name: '術師の妹スミ', dir: 's', talk: [L('……。')], cond: { var: 'ash_bout', eq: 3 } }),
      K.npc('opp_4', 'npc_pen_guard', 20, 8, { name: '鉄鎧のバルガ', dir: 's', talk: [L('……。')], cond: { var: 'ash_bout', eq: 4 } }),
      K.npc('opp_5', 'npc_zakuro', 20, 8, { name: 'ザクロ', dir: 's', talk: [L('……。')], cond: { var: 'ash_bout', eq: 5 } }),
    ];

    K.def('caldera_arena', {
      name: 'カルデラの闘技場', kind: 'interior', region: 'r_ash', location: 'caldera', theme: 'desert_town',
      legend: AK.ARENA(), rows: g, outside: 'wall_stone',
      objects: O, npcs: N,
      spawns: {
        door: { x: 19, y: 30, dir: 'n' },
        waiting: { x: 5, y: 26, dir: 'e' },
        sand: { x: 20, y: 14, dir: 'n' },
        gate: { x: 19, y: 22, dir: 'n' },
        plaque: { x: 4, y: 12, dir: 'w' },
      },
      exits: [{ x: 19, y: 31, w: 1, h: 1, to: { map: 'caldera', spawn: 'arena' } }],
      triggers: [{ id: 'arrive', on: 'enter', event: 'caldera_arena_arrive' }],
      zones: [],
      light: AK.LIGHT_ARENA, dark: false,
      bgm: 'town',
      meta: { sub: '火口の底の闘技場', minimap: false },
    });
  });
})(window.RPG);
