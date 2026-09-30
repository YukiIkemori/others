// CONTENT（終盤）: 終盤の場所（R.DB.locations、K.location）。ワープの一覧と地図の名前。
//   町: 書の都ビブリア（内海のまん中の島。ファロスの港から記録院の船で。着いたあとワープで行ける）。
//   ダンジョンの入口: 白の大書庫（一度入ったあと）。
//   地方 'finale'（short 'final' = 旗・イベント・選択の <rs>）: 年代記の章は持たない（'world' と同じく、地方の見出しと地図の霧だけ）。
//   地図の霧（R.WorldMap.regions.finale）と印（anchors）: 羊皮紙の内海の、ファロスの北東の小島（絵の px）。
(function (R) {
  'use strict';
  if (!R.DB.regions || !R.DB.regions.finale) {
    R.def('regions', 'finale', { name: R.T('regions.finale.name'), short: 'final', n: 10, chapter: { title: '', summary: '' } });
  }
  R.onData(function () {
    const WM = R.WorldMap;
    if (!WM) return;
    if (WM.regions && !WM.regions.finale) WM.regions.finale = [[1140, 640, 100]];
    if (WM.anchors) { if (!WM.anchors.biblia) WM.anchors.biblia = [1140, 640]; if (!WM.anchors.archive_1) WM.anchors.archive_1 = [1150, 622]; }
  });
  R.defs('locations', {
    biblia: { name: R.T('locations.biblia.name'), region: 'finale', kind: 'town', map: 'biblia', spawn: 'warp', warp: 'final_arrived' },
    archive: { name: R.T('locations.archive.name'), region: 'finale', kind: 'dungeon', map: 'archive_1', spawn: 'entrance', warp: 'final_archive_seen' },
  });
})(window.RPG);
