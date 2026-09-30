// CONTENT（マレア諸島）: 港町コーラル（coral、48×64）。WORLD_REDESIGN §5.8・§4.5、STORY_BIBLE §7.5・§8.6。
//   段々の白い港町: 海に面した崖に、白い家が 3 段に重なる。上の段 = 港の親方の家・見晴らし台（北の橋 → 白崖の道）、
//   中の段 = 宿・酒場・家 2、下の段 = 道具屋・武具屋・船乗り組合、いちばん下 = 岸壁（造船所の小屋・後家の壁・真ん中の桟橋（外洋船）・
//   定期船の T 字の桟橋・港の底の沈んだ軍船の帆柱 2 本）。段の間は長い石段（まん中の大通り・東の石段・西の小さな石段の路地）。
//   町の絵は 1 枚の下絵（v2/assets/env/isles/under/coral*）。当たりは絵に合わせた isles_painted_rows.js（R.Isles.PAINTED.coral）。
//   建物・戸口は下絵の敷地（blds）。造船所の小屋は絵の中の景色（中の船は船台の上。ドレイクは小屋の前の岸壁に立つ）。4 軒目の小さな家は戸の無い家。
//   灯り（港の灯 lamp_pillar = 白い石の柱の上の船のランタン）: 段の擁壁の上と桟橋の先の杭。道・戸口の前・出入り口には置かない。
//   飾りの小物は下絵に描いてある（持ち主の決まり）。ここに置くのは働く物（調べる物・宝箱・灯り・船）だけ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, IK = R.Isles.kit, L = K.L;
    const P = IK.painted('coral');
    const D = (map, sign) => ({ map, spawn: 'door', sign });
    const O = IK.blds('coral', {
      coral_harbormaster: D('coral_harbormaster'), coral_house1: D('coral_house1'), coral_inn: D('coral_inn', 'inn'), coral_tavern: D('coral_tavern', 'tavern'),
      coral_house2: D('coral_house2'), coral_house3: D('coral_house3'), coral_items: D('coral_items', 'item'), coral_arms: D('coral_arms', 'weapon'),
      coral_guild: D('coral_guild', 'guild'),
    });
    // ---------------------------------------------------------------- 働く物
    // 見晴らし台の石の看板（上の段の東の庭の角）
    O.push(K.prop('map_sign', 44, 4), K.exam(44, 4, 'coral_lookout'));
    // 北の橋の看板（橋のわきの崖）
    O.push(K.sign(20, 2, R.T('map.isles_coral.sign')));
    // 後家の壁（いちばん下の段の擁壁。岸壁から調べる）
    for (const x of [28, 31, 34, 37]) O.push(K.exam(x, 43, 'coral_widows_wall'));
    // 真ん中の桟橋: 外洋船の舵（船が無いうちは空の桟橋）と、つないだ船
    for (const x of [18, 19]) O.push(K.exam(x, 58, 'isles_helm'));
    O.push(K.prop('ship', 21, 56, { cond: 'isles_ship' }));
    // 定期船の T 字の桟橋の先: ファロスへ戻る乗り場（はい／いいえ）
    O.push({ type: 'door', x: 36, y: 60, look: 'none', to: { map: 'pharos', spawn: 'ferry' }, confirm: R.T('map.isles_coral.confirm') });
    O.push(K.prop('ship', 38, 62));
    // 光る貝がら（町の浜 = 岸壁の東の隅・西の路地の奥）
    O.push(K.exam(45, 49, 'isles_shell', { shell: 1 }), K.exam(11, 33, 'isles_shell', { shell: 2 }));
    // 宝箱（見える所だけ）: 上の段の東の庭・西の庭
    O.push(K.chest('coral_c1', 44, 8, { pool: 'p_T' }), K.chest('coral_c2', 2, 7, { item: 'i_potion', n: 2 }));
    // 港の灯（段の擁壁の上・桟橋の先の杭）
    for (const [x, y] of [[9, 12], [36, 12], [6, 27], [40, 27], [6, 40], [16, 40], [34, 40], [17, 58], [42, 59], [15, 51]]) O.push(K.prop('lamp_pillar', x, y));

    // ---------------------------------------------------------------- 人
    const N = [
      K.npc('drake', 'npc_drake', 14, 46, { name: R.T('map.isles_coral.N.0.drake.name'), title: R.T('map.isles_coral.N.0.drake.title'), dir: 'w', talk: 'coral_drake', reward: 'lead', pushable: false }),
      K.npc('gate_sailor', 'npc_isles_sailor', 25, 4, { name: R.T('map.isles_coral.N.1.gate_sailor.name'), dir: 's', talk: 'coral_gate_sailor', reward: 'news' }),
      K.npc('widow', 'npc_isles_old_f', 32, 45, { name: R.T('map.isles_coral.N.2.widow.name'), dir: 'n', talk: 'coral_widow', reward: 'news' }),
      K.npc('shell_kid', 'npc_isles_child', 40, 47, { name: R.T('map.isles_coral.N.3.shell_kid.name'), dir: 'w', talk: 'coral_shell_kid', reward: 'side' }),
      K.npc('idle_sailor', 'npc_isles_man', 27, 48, { name: R.T('map.isles_coral.N.4.idle_sailor.name'), dir: 's', talk: 'coral_idle_sailor', reward: 'boss' }),
      K.npc('child', 'npc_isles_child', 30, 26, { name: R.T('map.isles_coral.N.5.child.name'), dir: 's', move: 'wander', talk: 'coral_child', reward: 'hint' }),
      K.npc('ferry_hand', 'npc_isles_sailor', 39, 59, { name: R.T('map.isles_coral.N.6.ferry_hand.name'), dir: 'w', talk: 'coral_ferry_hand', reward: 'news', pushable: false }),
      K.npc('pier_fisher', 'npc_isles_old_m', 19, 53, { name: R.T('map.isles_coral.N.7.pier_fisher.name'), dir: 'e', talk: [L(R.T('map.isles_coral.N.talk.0.L')), L('cleared_r_isles', R.T('map.isles_coral.N.talk.1.cleared_r_isles'))], reward: null, cond: '!isles_ship' }),
      K.npc('dog', 'ani_dog', 17, 47, { name: R.T('map.isles_coral.N.8.dog.name'), dir: 'e', move: 'wander', talk: [L(R.T('map.isles_coral.N.talk.0.L_2'))], reward: null }),
    ];

    const sp = (bid) => IK.doorSpawn('coral', bid);
    K.def('coral', {
      name: R.T('map.isles_coral.coral.name'), kind: 'town', region: 'r_isles', location: 'coral', theme: 'harbor',
      legend: IK.TOWN(), rows: P.rows, outside: 'sea',
      objects: O, npcs: N,
      spawns: {
        north: { x: 22, y: 1, dir: 's' }, warp: { x: 23, y: 46, dir: 's' }, ferry: { x: 36, y: 57, dir: 'n' }, ship: { x: 19, y: 56, dir: 'n' },
        harbor: { x: 23, y: 45, dir: 's' },
        harbormaster: sp('coral_harbormaster'), house1: sp('coral_house1'), inn: sp('coral_inn'), tavern: sp('coral_tavern'), house2: sp('coral_house2'),
        house3: sp('coral_house3'), items: sp('coral_items'), arms: sp('coral_arms'), guild: sp('coral_guild'),
      },
      exits: [{ x: 21, y: 0, w: 4, h: 1, to: { map: 'i_cliff', spawn: 'south' } }],
      triggers: [{ id: 'arrival', on: 'enter', event: 'coral_arrival' }],
      zones: [],
      light: IK.LIGHT_TOWN, dark: false, bgm: 'town', bbg: 'isles',
      meta: { sub: R.T('map.isles_coral.coral.meta.sub'), chestsInfo: false },
      art: P.art,
    });
  });
})(window.RPG);
