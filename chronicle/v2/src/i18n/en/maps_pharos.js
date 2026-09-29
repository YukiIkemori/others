// 英語の文の表（maps_pharos）。key は日本語の表（src/i18n/ja/maps_pharos.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/pharos_town.js
    'map.pharos_town.pharos.name': 'Port Pharos',
  });
})(window.RPG);
