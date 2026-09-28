// CONTENT（湿原）: グレイモア湿原の場所（R.DB.locations、K.location。V2_PLAN §2.6.1）。ワープの一覧と地図の名前。
//   町: 水辺の町ロッホ。ダンジョンの入口: 霧の館（ロッホの東）・鐘沈みの沼（南。集会のあと霧の壁が開く）。
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    loch: { name: '水辺の町ロッホ', region: 'r_marsh', kind: 'town', map: 'loch', spawn: 'warp', warp: W },
    manor: { name: '霧の館', region: 'r_marsh', kind: 'dungeon', map: 'marsh_manor_1', spawn: 'entrance', warp: W },
    bog: { name: '鐘沈みの沼', region: 'r_marsh', kind: 'dungeon', map: 'marsh_bog', spawn: 'entrance', warp: 'marsh_assembly_done' },
  });
})(window.RPG);
