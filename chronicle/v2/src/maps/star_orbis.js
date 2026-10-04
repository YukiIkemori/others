// CONTENT（オルビス高原）: 学術都市オルビス（orbis、60×52）。WORLD_REDESIGN §5.12・§4.8、STORY_BIBLE §7.8・§8.9。
//   高い城壁の中を 3 つの区画に分ける: 市場区（南: 星の噴水の広場・宿「星明かり亭」・酒場「星見の杯亭」・道具屋・武具屋・学院の術具店・仕立屋・洗濯場）、
//   学院区（北西: 学院・図書館・守衛室・記録院の出張所）、天文台区（北東: 天文台・星灯の塔・研究者の家）。区画の間の塀に門（x 14・x 42）。
//   南門 → 列柱の高原、東門 → 星読みの尾根。北の大通りの先の北門は閉ざされている（鉄の格子。調べると一言）。
//   町の絵は 1 枚の下絵（v2/assets/env/star/under/orbis*）。当たりは絵に合わせた star_painted_rows.js（R.Star.PAINTED.orbis）。
//   建物・戸口は下絵の敷地（blds）。学院の大扉は昼は閉じている（調べると潜入の入口: star_academy_door）。研究者の家 1 軒は戸の無い家。
//   灯り（星灯 star_lamp = 大理石の柱の上の星形のガラスの灯）: 庭と広場の角。道・戸口の前・出入り口には置かない。星が消えて町は薄暗い（STORY_BIBLE §3.1）。
//   飾りの小物は下絵に描いてある（持ち主の決まり）。ここに置くのは働く物（調べる物・宝箱・灯り）だけ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, SK = R.Star.kit, L = K.L;
    const P = SK.painted('orbis');
    // 北門（大通りの北の端）は閉ざされた鉄の格子: 3 行目を壁に
    P.rows[3] = P.rows[3].slice(0, 27) + 'XXXX' + P.rows[3].slice(31);
    const D = (map, sign) => ({ map, spawn: 'door', sign });
    const O = SK.blds('orbis', {
      orbis_library: D('orbis_library'), orbis_observatory: D('orbis_observatory'), orbis_house4: D('orbis_house4'), orbis_house5: D('orbis_house5'),
      orbis_guardroom: D('orbis_guardroom'), orbis_records: D('orbis_records'), orbis_inn: D('orbis_inn', 'inn'), orbis_tavern: D('orbis_tavern', 'tavern'),
      orbis_tailor: D('orbis_tailor'), orbis_laundry: D('orbis_laundry'), orbis_items: D('orbis_items', 'item'), orbis_arms: D('orbis_arms', 'weapon'),
      orbis_magic: D('orbis_magic', 'magic'), orbis_house: D('orbis_house'), orbis_house2: D('orbis_house2'), orbis_house3: D('orbis_house3'),
    });
    // ---------------------------------------------------------------- 働く物
    O.push(K.exam(11, 10, 'star_academy_door'));                          // 学院の大扉（昼は閉じている。消灯の刻に忍びこむ）
    O.push(K.exam(15, 21, 'star_gate_notice'));                           // 学院区の門に貼られた命令書
    O.push(K.exam(4, 19, 'star_guard_window'));                           // 守衛室の窓（見回りの順番をのぞく）
    O.push(K.prop('iron_gate', 27, 3), K.prop('iron_gate', 29, 3), K.exam(28, 3, 'orbis_north_gate'));
    O.push(K.exam(45, 5, 'star_lamp_tower'));                             // 星灯の塔の油差し口
    O.push(K.exam(28, 29, 'orbis_fountain'));
    O.push(K.sign(26, 46, R.T('map.star_orbis.sign')));
    // 延滞の本（図書館の返却: 5 冊。見つけた本は消える）
    const BOOKS = [[34, 26], [3, 20], [54, 20], [3, 47], [54, 46]];
    BOOKS.forEach(([x, y], i) => O.push(K.prop('book_stack', x, y, { cond: `!star_book_${i + 1}` }), K.exam(x, y, 'star_book', { book: i + 1, cond: `!star_book_${i + 1}` })));
    // 学生の落とし物（天文台区の庭の草の中。頼まれてから）
    O.push(K.exam(33, 11, 'star_pen_spot', { cond: 'star_pen_asked' }));
    // 草の間の光（頼まれてから拾うまで。持ち主 2026-10-04「天文台の庭ってどのあたり？」→ 見つけやすく）
    O.push(K.prop('firefly', 33, 11, { cond: ['star_pen_asked', '!star_key_2', { not: { item: 'k_silver_pen' } }] }));
    // 宝箱（見える所だけ）
    O.push(K.chest('orbis_c1', 5, 11, { pool: 'p_T' }), K.chest('orbis_c2', 54, 47, { item: 'i_ether', n: 2 }));
    // 星灯（庭・広場の角）
    for (const [x, y] of [[8, 12], [20, 12], [34, 12], [22, 26], [22, 35], [34, 35], [5, 46], [48, 47]]) O.push(K.prop('star_lamp', x, y));

    // ---------------------------------------------------------------- 人
    const N = [
      K.npc('gate_guard', 'npc_pen_guard', 30, 46, { name: R.T('map.star_orbis.N.0.gate_guard.name'), dir: 'n', talk: 'orbis_gate_guard', reward: 'news', pushable: false }),
      K.npc('district_guard', 'npc_pen_guard', 15, 22, { name: R.T('map.star_orbis.N.1.district_guard.name'), dir: 's', talk: 'orbis_district_guard', reward: 'lead', pushable: false }),
      K.npc('academy_guard', 'npc_night_guard', 12, 12, { name: R.T('map.star_orbis.N.2.academy_guard.name'), dir: 's', talk: 'orbis_academy_guard', reward: 'hint', pushable: false, cond: '!cleared_r_star' }),
      K.npc('clerk', 'npc_clerk', 14, 13, { name: R.T('map.star_orbis.N.3.clerk.name'), dir: 'w', talk: 'orbis_clerk', reward: 'news', cond: '!star_octavia_done' }),
      K.npc('lamp_keeper', 'npc_star_old_m', 47, 14, { name: R.T('map.star_orbis.N.4.lamp_keeper.name'), dir: 'n', talk: 'star_lamp_keeper', reward: 'side' }),
      K.npc('researcher', 'npc_star_man', 36, 13, { name: R.T('map.star_orbis.N.5.researcher.name'), dir: 's', talk: 'orbis_researcher', reward: 'lead' }),
      K.npc('student_pen', 'npc_student', 24, 31, { name: R.T('map.star_orbis.N.6.student_pen.name'), dir: 'e', talk: 'star_student_pen', reward: 'item' }),
      K.npc('plaza_old', 'npc_star_old_m', 33, 33, { name: R.T('map.star_orbis.N.7.plaza_old.name'), dir: 'w', talk: 'orbis_plaza_old', reward: 'news' }),
      K.npc('plaza_woman', 'npc_star_woman', 23, 28, { name: R.T('map.star_orbis.N.8.plaza_woman.name'), dir: 's', talk: 'orbis_plaza_woman', reward: 'news' }),
      K.npc('child', 'npc_star_child', 25, 34, { name: R.T('map.star_orbis.N.9.child.name'), dir: 's', move: 'wander', talk: 'orbis_child', reward: 'hint' }),
      // 灯り直す場面（star_dawn: 広場。町じゅうが空を見上げる）
      K.npc('luca', 'npc_luka', 24, 32, { name: R.T('map.star_orbis.N.10.luca.name'), title: R.T('map.star_orbis.N.10.luca.title'), dir: 's', talk: 'star_luca', cond: 'star_dawn_scene' }),
      K.npc('octavia_dawn', 'npc_octavia', 23, 31, { name: R.T('map.star_orbis.N.11.octavia_dawn.name'), dir: 's', talk: 'star_octavia_after', cond: 'star_dawn_scene' }),
      K.npc('roof_old', 'npc_star_old_m', 27, 34, { name: R.T('map.star_orbis.N.12.roof_old.name'), dir: 'n', talk: 'orbis_plaza_old', cond: 'star_dawn_scene' }),
      K.npc('roof_kid', 'npc_star_child', 23, 34, { name: R.T('map.star_orbis.N.13.roof_kid.name'), dir: 'n', talk: 'orbis_child', cond: 'star_dawn_scene' }),
      K.npc('cat', 'ani_cat', 12, 36, { name: R.T('map.star_orbis.N.14.cat.name'), dir: 'e', move: 'wander', talk: [L(R.T('map.star_orbis.N.talk.0.L'))], reward: null }),
    ];

    const sp = (bid) => SK.doorSpawn('orbis', bid);
    K.def('orbis', {
      name: R.T('map.star_orbis.orbis.name'), kind: 'town', region: 'r_star', location: 'orbis', theme: 'harbor', propSet: 'star', propSetBase: 'village',
      legend: SK.TOWN(), rows: P.rows, outside: 'wall_marble',
      objects: O, npcs: N,
      spawns: {
        gate_s: { x: 28, y: 47, dir: 'n' }, gate_e: { x: 54, y: 30, dir: 'w' }, warp: { x: 29, y: 38, dir: 's' }, academy: { x: 11, y: 12, dir: 's' }, plaza: { x: 25, y: 33, dir: 'n' },
        library: sp('orbis_library'), observatory: sp('orbis_observatory'), house4: sp('orbis_house4'), house5: sp('orbis_house5'), guardroom: sp('orbis_guardroom'),
        records: sp('orbis_records'), inn: sp('orbis_inn'), tavern: sp('orbis_tavern'), tailor: sp('orbis_tailor'), laundry: sp('orbis_laundry'), items: sp('orbis_items'),
        arms: sp('orbis_arms'), magic: sp('orbis_magic'), house: sp('orbis_house'), house2: sp('orbis_house2'), house3: sp('orbis_house3'),
      },
      exits: [{ x: 27, y: 51, w: 3, h: 1, to: { map: 's_plateau', spawn: 'north' } }, { x: 59, y: 30, w: 1, h: 2, to: { map: 's_ridge', spawn: 'west' } }],
      triggers: [{ id: 'arrival', on: 'enter', event: 'orbis_arrival' }],
      zones: [],
      light: SK.LIGHT_TOWN, dark: false, bgm: 'star', bbg: 'star',
      meta: { sub: R.T('map.star_orbis.orbis.meta.sub'), chestsInfo: false },
      art: P.art,
    });
  });
})(window.RPG);
