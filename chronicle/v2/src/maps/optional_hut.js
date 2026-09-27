// CONTENT-F: きこりの休み小屋（#1、寄り道の屋内 12×9、hut）。V2_PLAN §3.2・§3.3 F13・STORY_BIBLE §7.1・§10.2
//   森の街道の脇。無料の寝床（全快）・途切れたきこりの日誌（l_forest_hut）・記録官の帳面（l_main_recorder_forest・lo_ev_forest）・宝箱 1。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const { g, door } = K.room(12, 9);
    K.rect(g, 4, 5, 4, 2, 'c');
    K.def('hut', {
      name: 'きこりの休み小屋', kind: 'interior', optional: true, region: 'r_forest', location: 'hut',
      legend: K.ROOM_LEGEND('wall_wood', 'wood_floor'),
      rows: g, outside: 'forest_dark',
      objects: R.ContentP.kit.furnish([      // 家具は文字の絵（prologue_00_kit.js）
        'B..S..F-.g',
        '.........g',
        'B...cTc..x',
        '..........',
        'k........b',
        'pl........'], '.ch..a....').concat([
        K.exam(1, 2, 'hut_bed'), K.exam(1, 4, 'hut_bed'),
        K.exam(6, 4, 'hut_journal'),                               // 卓の上の日誌
        K.exam(4, 3, 'hut_notes'),                                 // 棚の奥の帳面
        K.chest('hut_c1', 10, 7, { pool: 'p_T' }),
      ]),
      npcs: [],
      spawns: { door: { x: door.x, y: door.y - 1, dir: 'n' } },
      exits: [{ x: door.x, y: door.y, w: 1, h: 1, to: { map: 'world', spawn: 'hut' } }],
      triggers: [{ id: 'arrive', on: 'enter', event: 'hut_arrive', once: true }],
      light: { ambient: '#7a6c90', k: 0.7, mood: 'interior' },
      bgm: 'village',
      meta: { minimap: false, sub: '森の街道の脇' },
    });
  });
})(window.RPG);
