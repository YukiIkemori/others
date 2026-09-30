// CONTENT（マレア諸島）: 諸島の場所（R.DB.locations、K.location。V2_PLAN §2.6.1）。ワープの一覧と地図の名前。
//   町: 港町コーラル（ファロスの定期船で着く）・岬の村ネレイ。ダンジョンの入口: 潮鳴りの洞窟（夜光虫の入り江）・幽霊船（霧の海。マリナが歌ったあと）。
//   場所: 灯台島（外洋船で。灯台守のいない灯台）。
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    coral: { name: '港町コーラル', region: 'r_isles', kind: 'town', map: 'coral', spawn: 'warp', warp: W },
    nerei: { name: '岬の村ネレイ', region: 'r_isles', kind: 'town', map: 'nerei', spawn: 'warp', warp: W },
    tidecave: { name: '潮鳴りの洞窟', region: 'r_isles', kind: 'dungeon', map: 'isles_cave_1', spawn: 'entrance', warp: 'isles_cave_seen' },
    ghostship: { name: '幽霊船', region: 'r_isles', kind: 'dungeon', map: 'ghost_ship_1', spawn: 'board', warp: 'isles_fog_open' },
    lighthouse_isle: { name: '灯台島', region: 'r_isles', kind: 'place', map: 'i_light', spawn: 'boat', warp: 'isles_chart_light' },
  });
})(window.RPG);
