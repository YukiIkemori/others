// 英語の文の表（maps_marsh）。key は日本語の表（src/i18n/ja/maps_marsh.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/marsh_loch.js
    'map.marsh_loch.loch.name': 'Loch',
    // ---- src/maps/marsh_manor.js
    'map.marsh_manor.marsh_manor_1.name': 'Mist Manor',
    'map.marsh_manor.marsh_manor_2.name': 'Mist Manor',
  });
})(window.RPG);
