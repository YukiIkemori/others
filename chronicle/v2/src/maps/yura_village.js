// CONTENT-F: 隠れ里ユラ（#4、寄り道）と宿（yura・yura_inn）。V2_PLAN §3.2・WORLD_REDESIGN §5.14・STORY_BIBLE §8.10
//   森の中のくぼ地。こけむした家が円を描き、真ん中にこけの池と灯籠。村人は自分の名前が言えず、役目で呼び合う。
//   町 30×28（「ひろい」の表示より小さい所は外を深い森で埋める）。門は南（ワールド）。宿と、珍しいアクセサリの店（屋台）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const L = K.L;
    const W = 30, H = 28;
    const g = K.grid(W, H, '.');
    K.border(g, 'F', 2);
    for (const [x, y, rx, ry] of [[3, 3, 2, 2], [26, 3, 2, 2], [3, 24, 2, 2], [26, 24, 2, 2]]) K.blob(g, x, y, rx, ry, 'F', 'yb' + x + y);
    K.blob(g, 15, 13, 10, 8, ',', 'yg', '.');
    // 円い道とこけの池
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      const x = Math.round(15 + Math.cos(t) * 6.5), y = Math.round(13 + Math.sin(t) * 5);
      K.put(g, x, y, 'e');
    }
    K.blob(g, 15, 13, 2, 1, '~', 'ypond');
    K.path(g, [[14, 18], [14, 27]], 'e', 2);          // 南の門へ
    K.rect(g, 14, 25, 2, 3, 'r');

    const O = [];
    const B = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'moss', mat: 'bark', windows: 1, small: true }, o || {});
    O.push(B('yura_b_inn', 12, 2, 6, 4, { door: { x: 14, y: 5, to: { map: 'yura_inn', spawn: 'door' } }, sign: 'inn', windows: 2, lamp: true }));
    O.push(B('yura_b_elder', 3, 9, 5, 4, { door: { x: 5, y: 12, to: { map: 'yura_home_elder', spawn: 'door' } }, mat: 'stone', lamp: true }));   // 家の中は homes_slice.js
    O.push(B('yura_b_h1', 21, 3, 5, 4, { door: { x: 23, y: 6, to: { map: 'yura_home1', spawn: 'door' } } }));
    O.push(B('yura_b_h2', 23, 11, 5, 4, { door: { x: 25, y: 14, to: { map: 'yura_home2', spawn: 'door' } } }));
    O.push(B('yura_b_h3', 20, 19, 5, 4, { door: { x: 22, y: 22, to: { map: 'yura_home3', spawn: 'door' } } }));
    O.push(B('yura_b_h4', 5, 18, 5, 4, { door: { x: 7, y: 21, to: { map: 'yura_home4', spawn: 'door' } }, mat: 'log' }));
    O.push(K.prop('stall', 17, 20), K.prop('crate', 18, 21), K.prop('sack', 19, 21));
    O.push(K.prop('well', 9, 7), K.prop('bench', 18, 9), K.prop('bench', 11, 17));
    for (const [x, y] of [[12, 11], [18, 11], [12, 15], [18, 15], [13, 24], [16, 24], [9, 13], [21, 13]]) O.push(K.prop('lantern', x, y));
    for (const [x, y] of [[4, 15], [10, 4], [25, 9], [26, 18], [19, 24], [8, 23], [3, 7], [22, 8]]) O.push(K.prop('mushroom_glow', x, y, { variant: (x + y) % 4 }));
    O.push(K.prop('grave', 26, 21), K.prop('grave', 27, 22), K.prop('flower_pot', 11, 6), K.prop('planter', 20, 7), K.prop('rock', 4, 5), K.prop('stump', 27, 13));
    O.push(K.prop('songstone', 15, 10, { variant: 3 }), K.exam(15, 11, 'yura_stone'));
    O.push(K.chest('yura_c1', 3, 20, { pool: 'p_T' }));
    O.push(K.sign(16, 25, '――ここはユラ。\n名を置いてきた者の里。'));
    K.scatter(g, O, 'firefly', 6, [2, 2, 26, 24], ',.', 'yff', { gap: 4 });

    const N = [
      K.npc('yura_elder', 'npc_yura_elder', 6, 13, { name: '長老', title: '――名を忘れた長', dir: 's', talk: 'yura_elder', reward: 'side' }),
      K.npc('yura_miller', 'npc_yura_folk_2', 9, 9, { name: '粉ひき', dir: 'e', talk: 'yura_miller', reward: 'side', cond: '!yura_miller_home' }),
      K.npc('yura_nanny', 'npc_yura_folk_1', 20, 14, { name: '子守', dir: 'w', talk: 'yura_nanny', reward: 'hint' }),
      K.npc('yura_grave', 'npc_yura_folk_3', 25, 20, { name: '墓守', dir: 'w', talk: 'yura_gravekeeper', reward: 'news' }),
      K.npc('yura_lamp', 'npc_yura_folk_4', 17, 12, { name: '灯守', dir: 's', talk: 'yura_lampkeeper', reward: 'item' }),
      K.npc('yura_seller', 'npc_yura_folk_1', 17, 21, { name: '店番', dir: 'n', talk: 'yura_seller', reward: null, pushable: false }),
      K.npc('yura_child', 'npc_child_4', 12, 20, { name: '名のない子', dir: 'e', move: 'wander', talk: 'yura_child', reward: 'hint' }),
      K.npc('yura_cat', 'ani_cat', 22, 16, { name: '猫', dir: 'w', move: 'wander', talk: [L('ニャア。')], reward: null }),
    ];

    K.def('yura', {
      name: '隠れ里ユラ', kind: 'town', optional: true, region: 'r_forest', location: 'yura', theme: 'moss_village',
      legend: K.FOREST_LEGEND({}),
      rows: g, outside: 'forest_dark',
      objects: O, npcs: N,
      spawns: {
        gate: { x: 14, y: 24, dir: 'n' },
        inn: { x: 14, y: 6, dir: 's' },
        elder_door: { x: 5, y: 13, dir: 's' }, h1_door: { x: 23, y: 7, dir: 's' }, h2_door: { x: 25, y: 15, dir: 's' },
        h3_door: { x: 22, y: 23, dir: 's' }, h4_door: { x: 7, y: 22, dir: 's' },
      },
      exits: [{ x: 14, y: 27, w: 2, h: 1, to: { map: 'world', spawn: 'yura' } }],
      triggers: [{ id: 'arrival', on: 'enter', event: 'yura_arrival', once: true }],
      zones: [],
      light: { ambient: '#56609a', k: 0.45, mood: 'forest_night' },
      bgm: 'sorrow',
      meta: { sub: '名を置いてきた者の里' },
    });

    // ---------------------------------------------------------------- ユラの宿 11×9（家具は文字の絵 R.ContentP.kit.furnish）
    const room = K.room(11, 9, {});
    K.rect(room.g, 3, 5, 3, 2, 'c');
    K.def('yura_inn', {
      name: 'ユラの宿', kind: 'interior', optional: true, region: 'r_forest', location: 'yura',
      legend: K.ROOM_LEGEND('wall_moss', 'wood_floor'),
      rows: room.g, outside: 'wall_moss',
      objects: R.ContentP.kit.furnish([
        'JK..C.B.B',
        '.........',
        'N-n......',
        '....cTc..',
        'P.......b',
        'pk......x'], '..yc...w.'),
      npcs: [
        K.npc('yura_innkeeper', 'npc_yura_folk_3', 2, 3, { name: '宿番', dir: 's', talk: 'yura_inn_keeper', pushable: false }),
        K.npc('yura_guest', 'npc_yura_folk_4', 8, 5, { name: '泊まり客', dir: 'w', talk: [L('ここに来た日のことは、\nよく覚えているの。\n……自分の名前のほかは。')], reward: null }),
      ],
      spawns: { door: { x: room.door.x, y: 7, dir: 'n' } },
      exits: [{ x: room.door.x, y: 8, w: 2, h: 1, to: { map: 'yura', spawn: 'inn' } }],
      triggers: [],
      light: { ambient: '#6e6282', k: 0.8, mood: 'interior' },
      bgm: 'sorrow',
      meta: { minimap: false },
    });
  });
})(window.RPG);
