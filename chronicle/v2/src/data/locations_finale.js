// CONTENT（終盤）: 終盤の場所（R.DB.locations、K.location）。ワープの一覧と地図の名前。
//   町: 書の都ビブリア（内海のまん中の島。ファロスの港から記録院の船で。着いたあとワープで行ける）。
//   ダンジョンの入口: 白の大書庫（一度入ったあと）。
(function (R) {
  'use strict';
  R.defs('locations', {
    biblia: { name: R.T('locations.biblia.name'), region: 'finale', kind: 'town', map: 'biblia', spawn: 'warp', warp: 'final_arrived' },
    archive: { name: R.T('locations.archive.name'), region: 'finale', kind: 'dungeon', map: 'archive_1', spawn: 'entrance', warp: 'final_archive_seen' },
  });
})(window.RPG);
