// 英語の文の表（maps_forest）。key は日本語の表（src/i18n/ja/maps_forest.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/fern_village.js
    'map.fern_village.fern.name': 'Fern',
    // ---- src/maps/yura_village.js
    'map.yura_village.yura.name': 'Yura, the Hidden Village',
    'map.yura_village.yura_inn.name': 'Yura Inn',
  });
})(window.RPG);
