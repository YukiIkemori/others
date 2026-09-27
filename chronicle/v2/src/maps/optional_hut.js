// CONTENT-F: 樵の休み小屋（#1、寄り道の屋内 16×12、hut）。V2_PLAN §3.2・§3.3 F13・STORY_BIBLE §7.1・§10.2
//   森の街道の脇。無料の寝床（全快）・途切れた樵の日誌（l_forest_hut）・記録官の帳面（l_main_recorder_forest・lo_ev_forest）・宝箱 1。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const { g, door } = K.room(16, 12, { doorX: 7 });
    K.rect(g, 5, 6, 6, 3, 'c');
    K.def('hut', {
      name: '樵の休み小屋', kind: 'interior', optional: true, region: 'r_forest', location: 'hut',
      legend: K.ROOM_LEGEND('wall_wood', 'wood_floor'),
      rows: g, outside: 'forest_dark',
      objects: [
        K.prop('bed', 1, 2), K.prop('bed', 1, 4), K.exam(2, 3, 'hut_bed'), K.exam(2, 5, 'hut_bed'),
        K.prop('stove', 13, 2), K.prop('log', 14, 5), K.prop('log', 14, 6), K.prop('crate', 14, 8), K.prop('barrel', 14, 9),
        K.prop('table', 7, 7), K.prop('chair', 6, 7), K.prop('chair', 9, 7),
        K.exam(8, 7, 'hut_journal'),                               // 卓の上の日誌
        K.prop('bookshelf', 5, 2), K.exam(5, 3, 'hut_notes'),      // 棚の奥の帳面
        K.prop('lantern', 8, 3), K.prop('lantern', 11, 9), K.prop('sack', 11, 2), K.prop('flower_pot', 10, 2),
        K.chest('hut_c1', 13, 9, { pool: 'p_T' }),
      ],
      npcs: [],
      spawns: { door: { x: door.x, y: 10, dir: 'n' } },
      exits: [{ x: door.x, y: 11, w: 2, h: 1, to: { map: 'world', spawn: 'hut' } }],
      triggers: [{ id: 'arrive', on: 'enter', event: 'hut_arrive', once: true }],
      light: { ambient: '#7a6c90', k: 0.7, mood: 'interior' },
      bgm: 'village',
      meta: { minimap: false, sub: '森の街道の脇' },
    });
  });
})(window.RPG);
