// CONTENT-F: 隠れ里ユラ（#4、寄り道）と宿（yura・yura_inn）。V2_PLAN §3.2・WORLD_REDESIGN §5.14・STORY_BIBLE §8.10
//   森のくぼ地を流れる小川の、水車の里。石と芝土のまるい小屋が、大きな水車と水車池のまわりに寄りそう。
//   北西の小山には渦を巻く小道が上り、てっぺんに名の無い墓石と墓守。川は飛び石でわたる。村人は自分の名前が言えず、役目で呼び合う。
//   町 30×28。門は南（ワールド）。宿と、珍しいアクセサリの店（屋台）。
//   里ぜんたいを 1 枚に描いた下絵（v2/assets/env/moss_village/under/yura*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物はこのデータ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const L = K.L;
    const W = 30, H = 28;
    const g = K.grid(W, H, ',');
    K.border(g, 'F', 2);
    // 北西の小山: 渦の小道（p）が入口 (9,9) から外回りに上り、てっぺんの草地（g）へ。h = 小山の斜面（通れない）
    K.stamp(g, 2, 2, [
      'ThhhhhhhT',
      'hppppppph',
      'hphhhhhph',
      'hphggghph',
      'hphggghph',
      'hphhhghph',
      'hppppphph',
      'ThhhhhhpT']);
    // 小川: 北の森から水車の脇を流れ（x 24-25）、里のまん中を西へ（y 11-12）。水車の下の池（y 10・13）
    K.rect(g, 24, 0, 2, 13, '~');
    K.rect(g, 0, 11, 26, 2, '~');
    K.rect(g, 22, 10, 2, 1, '~');
    K.rect(g, 21, 13, 5, 1, '~');
    K.rect(g, 26, 2, 2, 11, 'T');   // 小川の東は木立
    for (const [x, y] of [[9, 11], [9, 12], [16, 11], [16, 12]]) K.put(g, x, y, 's');   // 飛び石
    // 小道
    K.hline(g, 9, 16, 10, 'e');                 // 小山の入口 ↔ 飛び石
    K.vline(g, 13, 7, 9, 'e');                  // 長老の家
    K.put(g, 9, 13, 'e'); K.hline(g, 14, 16, 13, 'e');
    K.rect(g, 14, 13, 2, 15, 'e');              // 南の門へ（y 27 が出口）
    K.hline(g, 6, 13, 18, 'e');                 // 宿
    K.hline(g, 5, 13, 24, 'e');                 // h4
    K.hline(g, 16, 26, 19, 'e');                // h1・h2
    K.hline(g, 16, 22, 25, 'e');                // 子守の家（h3）
    K.rect(g, 2, 24, 2, 2, 'T'); K.rect(g, 26, 23, 2, 3, 'T');

    const O = [];
    // まるい小屋（石の壁と芝土の屋根）。戸口は描いた扉の下の 1 マス
    const B = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'moss', mat: 'stone', windows: 1, small: true }, o || {});
    O.push(B('yura_hut_inn', 3, 14, 7, 4, { door: { x: 6, y: 17, to: { map: 'yura_inn', spawn: 'door' } }, sign: 'inn', windows: 2, lamp: true }));
    O.push(B('yura_hut_elder', 12, 3, 4, 4, { door: { x: 13, y: 6, to: { map: 'yura_home_elder', spawn: 'door' } }, lamp: true }));   // 家の中は homes_slice.js
    O.push(B('yura_hut_h1', 19, 15, 4, 4, { door: { x: 21, y: 18, to: { map: 'yura_home1', spawn: 'door' } } }));
    O.push(B('yura_hut_h2', 24, 15, 4, 4, { door: { x: 26, y: 18, to: { map: 'yura_home2', spawn: 'door' } } }));
    O.push(B('yura_hut_h3', 20, 21, 4, 4, { door: { x: 22, y: 24, to: { map: 'yura_home3', spawn: 'door' } }, lamp: true }));   // 子守の家
    O.push(B('yura_hut_h4', 3, 20, 4, 4, { door: { x: 5, y: 23, to: { map: 'yura_home4', spawn: 'door' } } }));
    O.push(B('yura_mill', 17, 2, 7, 6, { windows: 2, small: false }));   // 粉ひき小屋と大水車（東の x 22-24）。戸は描かない（入らない）
    // 粉ひきの庭・屋台・広場
    O.push(K.prop('sack', 18, 8), K.prop('barrel', 16, 5));   // 小物は壁ぎわに少しだけ（持ち主 2026-09-27: 移動の邪魔になる小物は置かない）
    O.push(K.prop('stall', 11, 20), K.prop('crate', 10, 20));
    O.push(K.prop('bench', 17, 21), K.prop('bench', 12, 16), K.prop('flower_pot', 11, 6));
    O.push(K.prop('stump', 2, 13), K.prop('rock', 27, 21));
    // 灯り: 置き灯籠（当たりなし）を水辺・小道の脇に。街灯は立てない
    for (const [x, y] of [[10, 10], [17, 10], [8, 13], [17, 13], [13, 17], [16, 17], [13, 22], [16, 22], [19, 20], [7, 19], [23, 25], [18, 7], [7, 7]]) O.push(K.prop('lantern', x, y));
    for (const [x, y] of [[11, 4], [16, 3], [2, 10], [9, 22], [25, 24], [18, 25]]) O.push(K.prop('mushroom_glow', x, y, { variant: (x + y) % 4 }));
    for (const [x, y] of [[4, 10], [20, 10], [19, 13]]) O.push(K.prop('reeds', x, y, { variant: (x + y) % 4 }));
    // 小山のてっぺん: 名の無い墓石
    O.push(K.prop('grave', 5, 5), K.prop('grave', 6, 5), K.prop('grave', 7, 5));
    O.push(K.prop('songstone', 20, 13, { variant: 3 }), K.exam(20, 14, 'yura_stone'));   // 水車池のほとりの、名を削った石
    O.push(K.chest('yura_c1', 2, 19, { pool: 'p_T' }));
    O.push(K.sign(13, 25, R.T('map.yura_village.sign')));
    K.scatter(g, O, 'firefly', 4, [2, 13, 26, 13], ',', 'yff', { gap: 4 });

    const N = [
      K.npc('yura_elder', 'npc_yura_elder', 15, 8, { name: R.T('map.yura_village.N.0.yura_elder.name'), title: R.T('map.yura_village.N.0.yura_elder.title'), dir: 's', talk: 'yura_elder', reward: 'side' }),
      K.npc('yura_miller', 'npc_yura_folk_2', 22, 8, { name: R.T('map.yura_village.N.1.yura_miller.name'), dir: 'n', talk: 'yura_miller', reward: 'side', cond: '!yura_miller_home' }),
      K.npc('yura_nanny', 'npc_yura_folk_1', 18, 23, { name: R.T('map.yura_village.N.2.yura_nanny.name'), dir: 's', talk: 'yura_nanny', reward: 'hint' }),
      K.npc('yura_grave', 'npc_yura_folk_3', 5, 6, { name: R.T('map.yura_village.N.3.yura_grave.name'), dir: 'e', talk: 'yura_gravekeeper', reward: 'news' }),
      K.npc('yura_lamp', 'npc_yura_folk_4', 12, 19, { name: R.T('map.yura_village.N.4.yura_lamp.name'), dir: 's', talk: 'yura_lampkeeper', reward: 'item' }),
      K.npc('yura_seller', 'npc_yura_folk_1', 11, 21, { name: R.T('map.yura_village.N.5.yura_seller.name'), dir: 's', talk: 'yura_seller', reward: null, pushable: false }),
      K.npc('yura_child', 'npc_child_4', 16, 23, { name: R.T('map.yura_village.N.6.yura_child.name'), dir: 'e', move: 'wander', talk: 'yura_child', reward: 'hint' }),
      K.npc('yura_cat', 'ani_cat', 24, 21, { name: R.T('map.yura_village.N.7.yura_cat.name'), dir: 'w', move: 'wander', talk: [L(R.T('map.yura_village.N.talk.0.L'))], reward: null }),
    ];

    K.def('yura', {
      name: R.T('map.yura_village.yura.name'), kind: 'town', optional: true, region: 'r_forest', location: 'yura', theme: 'moss_village',
      legend: K.FOREST_LEGEND({
        s: { mat: 'stone_floor', name: 'stepping_stones' },
        h: { mat: 'cliff', solid: true },
        p: { mat: 'dirt', name: 'hill_path' },
        g: { mat: 'grass', name: 'hill_top' },
      }),
      rows: g, outside: 'forest_dark',
      objects: O, npcs: N,
      spawns: {
        gate: { x: 14, y: 24, dir: 'n' },
        inn: { x: 6, y: 18, dir: 's' },
        elder_door: { x: 13, y: 7, dir: 's' }, h1_door: { x: 21, y: 19, dir: 's' }, h2_door: { x: 26, y: 19, dir: 's' },
        h3_door: { x: 22, y: 25, dir: 's' }, h4_door: { x: 5, y: 24, dir: 's' },
      },
      exits: [{ x: 14, y: 27, w: 2, h: 1, to: { map: 'world', spawn: 'yura' } }],
      triggers: [{ id: 'arrival', on: 'enter', event: 'yura_arrival', once: true }],
      zones: [],
      light: { ambient: '#56609a', k: 0.45, mood: 'forest_night' },
      bgm: 'sorrow',
      meta: { sub: R.T('map.yura_village.yura.meta.sub') },
      // 里ぜんたいを 1 枚に描いた下絵（地面・小屋・水車・小山・川・森）。当たり・戸口・人・灯り・墓石ほかの物は上のデータのまま。絵が無ければマスから焼く
      art: { image: 'moss_village/under/yura', overlay: 'moss_village/under/yura_over', emit: 'moss_village/under/yura_emit', painted: ['barrel@16,5', 'flower_pot@11,6', 'sack@18,8', 'stump@2,13', 'bench@12,16', 'crate@10,20', 'bench@17,21', 'rock@27,21'] },
    });

    // ---------------------------------------------------------------- ユラの宿 11×9（家具は文字の絵 R.ContentP.kit.furnish）
    const room = K.room(11, 9, {});
    K.rect(room.g, 3, 5, 3, 2, 'c');
    K.def('yura_inn', {
      name: R.T('map.yura_village.yura_inn.name'), kind: 'interior', optional: true, region: 'r_forest', location: 'yura',
      legend: K.ROOM_LEGEND('wall_moss', 'wood_floor'),
      rows: room.g, outside: 'wall_moss',
      objects: R.ContentP.kit.furnish([
        'JK..C.B.B',
        '.........',
        'N-.......',
        '....cTc..',
        'P.......b',
        'pk......x'], '..yc...w.'),
      npcs: [
        K.npc('yura_innkeeper', 'npc_yura_folk_3', 2, 3, { name: R.T('map.yura_village.yura_inn.npcs.0.yura_innkeeper.name'), dir: 's', talk: 'yura_inn_keeper', pushable: false }),
        K.npc('yura_guest', 'npc_yura_folk_4', 8, 5, { name: R.T('map.yura_village.yura_inn.npcs.1.yura_guest.name'), dir: 'w', talk: [L(R.T('map.yura_village.yura_inn.talk.0.L'))], reward: null }),
      ],
      spawns: { door: { x: room.door.x, y: 7, dir: 'n' } },
      exits: [{ x: room.door.x, y: 8, w: 1, h: 1, to: { map: 'yura', spawn: 'inn' } }],
      triggers: [],
      light: { ambient: '#6e6282', k: 0.8, mood: 'interior' },
      bgm: 'sorrow',
      meta: { minimap: false },
    });
  });
})(window.RPG);
